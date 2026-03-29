package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const defaultStateID = "primary"

type mongoStateBackend struct {
	client   *mongo.Client
	database *mongo.Database
}

const (
	mongoCollectionDraftPosts    = "draft_posts"
	mongoCollectionDraftProjects = "draft_projects"
	mongoCollectionTags          = "tags"
	mongoCollectionDraftPages    = "draft_pages"
	mongoCollectionUsers         = "users"
)

func newMongoStateBackend(mongoURL, databaseName string) (*mongoStateBackend, error) {
	if mongoURL == "" {
		return nil, errors.New("MONGO_URL is required")
	}
	if databaseName == "" {
		return nil, errors.New("MONGO_DATABASE_NAME is required")
	}

	client, err := mongo.Connect(options.Client().ApplyURI(mongoURL))
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}

	backend := &mongoStateBackend{
		client:   client,
		database: client.Database(databaseName),
	}
	if err := backend.ensureSchema(ctx); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}

	return backend, nil
}

func (b *mongoStateBackend) ensureSchema(ctx context.Context) error {
	indexSpecs := []struct {
		collection string
		models     []mongo.IndexModel
	}{
		{
			collection: mongoCollectionDraftPosts,
			models: []mongo.IndexModel{
				{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)},
			},
		},
		{
			collection: mongoCollectionDraftProjects,
			models: []mongo.IndexModel{
				{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)},
			},
		},
		{
			collection: mongoCollectionTags,
			models: []mongo.IndexModel{
				{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)},
			},
		},
		{
			collection: mongoCollectionUsers,
			models: []mongo.IndexModel{
				{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
				{Keys: bson.D{{Key: "git_author_email", Value: 1}}, Options: options.Index().SetUnique(true).SetSparse(true)},
			},
		},
		{
			collection: mongoCollectionDraftPages,
			models:     []mongo.IndexModel{},
		},
	}

	for _, spec := range indexSpecs {
		if len(spec.models) == 0 {
			continue
		}
		if _, err := b.database.Collection(spec.collection).Indexes().CreateMany(ctx, spec.models); err != nil {
			return err
		}
	}
	return nil
}

func (b *mongoStateBackend) Load() (persistedData, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	posts, err := loadMongoCollection[persistedPost](ctx, b.database.Collection(mongoCollectionDraftPosts))
	if err != nil {
		return persistedData{}, false, err
	}
	projects, err := loadMongoCollection[persistedProject](ctx, b.database.Collection(mongoCollectionDraftProjects))
	if err != nil {
		return persistedData{}, false, err
	}
	tags, err := loadMongoCollection[persistedTag](ctx, b.database.Collection(mongoCollectionTags))
	if err != nil {
		return persistedData{}, false, err
	}

	home, homeOK, err := loadMongoSingle[persistedHome](ctx, b.database.Collection(mongoCollectionDraftPages), bson.M{"_id": "home"})
	if err != nil {
		return persistedData{}, false, err
	}
	adminProfile, profileOK, err := loadMongoSingle[persistedAdminProfile](ctx, b.database.Collection(mongoCollectionUsers), bson.M{"_id": defaultStateID})
	if err != nil {
		return persistedData{}, false, err
	}

	ok := len(posts) > 0 || len(projects) > 0 || len(tags) > 0 || homeOK || profileOK
	if !ok {
		return persistedData{}, false, nil
	}

	return persistedData{
		Posts:        posts,
		Projects:     projects,
		Tags:         tags,
		Home:         home,
		AdminProfile: adminProfile,
	}, true, nil
}

func (b *mongoStateBackend) Save(data persistedData) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := syncMongoCollection(ctx, b.database.Collection(mongoCollectionDraftPosts), data.Posts, func(item persistedPost) string {
		return item.ID
	}); err != nil {
		return err
	}
	if err := syncMongoCollection(ctx, b.database.Collection(mongoCollectionDraftProjects), data.Projects, func(item persistedProject) string {
		return item.ID
	}); err != nil {
		return err
	}
	if err := syncMongoCollection(ctx, b.database.Collection(mongoCollectionTags), data.Tags, func(item persistedTag) string {
		return item.ID
	}); err != nil {
		return err
	}
	if err := syncMongoSingle(ctx, b.database.Collection(mongoCollectionDraftPages), "home", data.Home); err != nil {
		return err
	}
	return syncMongoSingle(ctx, b.database.Collection(mongoCollectionUsers), defaultStateID, data.AdminProfile)
}

func loadMongoCollection[T any](ctx context.Context, collection *mongo.Collection) ([]T, error) {
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	items := []T{}
	for cursor.Next(ctx) {
		var document bson.M
		if err := cursor.Decode(&document); err != nil {
			return nil, err
		}

		item, err := fromMongoDocument[T](document)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func loadMongoSingle[T any](ctx context.Context, collection *mongo.Collection, filter bson.M) (T, bool, error) {
	var zero T
	var document bson.M
	err := collection.FindOne(ctx, filter).Decode(&document)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return zero, false, nil
	}
	if err != nil {
		return zero, false, err
	}

	item, err := fromMongoDocument[T](document)
	if err != nil {
		return zero, false, err
	}
	return item, true, nil
}

func syncMongoCollection[T any](ctx context.Context, collection *mongo.Collection, items []T, idFn func(T) string) error {
	existingIDs, err := loadMongoIDs(ctx, collection)
	if err != nil {
		return err
	}

	nextIDs := make(map[string]struct{}, len(items))
	models := make([]mongo.WriteModel, 0, len(items))
	for _, item := range items {
		id := idFn(item)
		nextIDs[id] = struct{}{}

		document, err := toMongoDocument(item, id)
		if err != nil {
			return err
		}

		models = append(models, mongo.NewReplaceOneModel().
			SetFilter(bson.M{"_id": id}).
			SetReplacement(document).
			SetUpsert(true))
	}

	if len(models) > 0 {
		if _, err := collection.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false)); err != nil {
			return err
		}
	}

	staleIDs := make([]string, 0, len(existingIDs))
	for _, id := range existingIDs {
		if _, ok := nextIDs[id]; ok {
			continue
		}
		staleIDs = append(staleIDs, id)
	}
	if len(staleIDs) == 0 {
		return nil
	}

	_, err = collection.DeleteMany(ctx, bson.M{"_id": bson.M{"$in": staleIDs}})
	return err
}

func syncMongoSingle(ctx context.Context, collection *mongo.Collection, id string, value any) error {
	document, err := toMongoDocument(value, id)
	if err != nil {
		return err
	}
	_, err = collection.ReplaceOne(ctx, bson.M{"_id": id}, document, options.Replace().SetUpsert(true))
	return err
}

func loadMongoIDs(ctx context.Context, collection *mongo.Collection) ([]string, error) {
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetProjection(bson.M{"_id": 1}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	ids := make([]string, 0)
	for cursor.Next(ctx) {
		var document struct {
			ID string `bson:"_id"`
		}
		if err := cursor.Decode(&document); err != nil {
			return nil, err
		}
		ids = append(ids, document.ID)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return ids, nil
}

func toMongoDocument(value any, id string) (bson.M, error) {
	payload, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}

	var document bson.M
	if err := bson.UnmarshalExtJSON(payload, false, &document); err != nil {
		return nil, err
	}
	document["_id"] = id
	return document, nil
}

func fromMongoDocument[T any](document bson.M) (T, error) {
	var item T
	payload, err := json.Marshal(document)
	if err != nil {
		return item, err
	}
	if err := json.Unmarshal(payload, &item); err != nil {
		return item, err
	}
	return item, nil
}
