package operational

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/gitrepo"
	contentstore "github.com/hyunbridge/website/backend/internal/store"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"gopkg.in/yaml.v3"
)

const (
	CollectionReleaseJobs = "release_jobs"
	CollectionLiveState   = "live_state"
	CollectionDeployLocks = "deploy_locks"
	deployLockID          = "deploy"
	deployLockClaiming    = "__claiming__"
)

type MongoStore struct {
	client        *mongo.Client
	database      *mongo.Database
	now           func() time.Time
	gitStore      *GitStore
	publicBaseURL *string
}

type mongoReleaseJob struct {
	ID               string                               `bson:"_id"`
	Type             string                               `bson:"type"`
	Status           string                               `bson:"status"`
	CommitSHA        *string                              `bson:"commit_sha,omitempty"`
	RequestedBy      string                               `bson:"requested_by"`
	Logs             []string                             `bson:"logs"`
	Meta             map[string]any                       `bson:"meta"`
	Manifest         *PublishManifest                     `bson:"manifest,omitempty"`
	CreatedAt        string                               `bson:"created_at"`
	UpdatedAt        string                               `bson:"updated_at"`
	StartedAt        *string                              `bson:"started_at,omitempty"`
	CompletedAt      *string                              `bson:"completed_at,omitempty"`
	RollbackSnapshot *contentstore.PublishPointerSnapshot `bson:"rollback_snapshot,omitempty"`
}

type mongoLiveState struct {
	ID               string                               `bson:"_id"`
	LiveCommitSHA    string                               `bson:"live_commit_sha"`
	LastDeployJobID  *string                              `bson:"last_deploy_job_id,omitempty"`
	LastSuccessfulAt *string                              `bson:"last_successful_at,omitempty"`
	PublicBaseURL    *string                              `bson:"public_base_url,omitempty"`
	LivePointers     *contentstore.PublishPointerSnapshot `bson:"live_pointers,omitempty"`
}

type mongoDeployLock struct {
	ID          string  `bson:"_id"`
	HolderJobID *string `bson:"holder_job_id,omitempty"`
	CreatedAt   string  `bson:"created_at"`
	UpdatedAt   string  `bson:"updated_at"`
}

func NewMongoStore(ctx context.Context, uri string, databaseName string, repo *gitrepo.Repository, publicBaseURL string) (*MongoStore, error) {
	if uri == "" {
		return nil, errors.New("mongo uri is required")
	}
	if databaseName == "" {
		return nil, errors.New("mongo database name is required")
	}

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		_ = client.Disconnect(ctx)
		return nil, err
	}

	var gitStore *GitStore
	if repo != nil {
		gitStore, err = NewGitStore(repo, publicBaseURL)
		if err != nil {
			_ = client.Disconnect(ctx)
			return nil, err
		}
	}

	publicBaseURL = strings.TrimSpace(publicBaseURL)
	return &MongoStore{
		client:        client,
		database:      client.Database(databaseName),
		now:           time.Now,
		gitStore:      gitStore,
		publicBaseURL: stringPtr(publicBaseURL),
	}, nil
}

func (s *MongoStore) Dashboard(limit int) (Dashboard, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var dashboard Dashboard

	var live mongoLiveState
	err := s.database.Collection(CollectionLiveState).FindOne(ctx, bson.M{"_id": "live"}).Decode(&live)
	if err == nil {
		dashboard.LiveState = &LiveState{
			ID:               live.ID,
			LiveCommitSHA:    live.LiveCommitSHA,
			LastDeployJobID:  live.LastDeployJobID,
			LastSuccessfulAt: live.LastSuccessfulAt,
			PublicBaseURL:    live.PublicBaseURL,
			LivePointers:     live.LivePointers,
		}
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		return Dashboard{}, err
	}
	if dashboard.LiveState == nil && s.publicBaseURL != nil {
		dashboard.LiveState = &LiveState{
			ID:            "live",
			PublicBaseURL: stringPtr(derefString(s.publicBaseURL)),
		}
	} else if dashboard.LiveState != nil && dashboard.LiveState.PublicBaseURL == nil {
		dashboard.LiveState.PublicBaseURL = stringPtr(derefString(s.publicBaseURL))
	}

	if limit <= 0 {
		limit = 20
	}

	cursor, err := s.database.Collection(CollectionReleaseJobs).Find(
		ctx,
		bson.M{},
		options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(int64(limit)),
	)
	if err != nil {
		return Dashboard{}, err
	}
	defer cursor.Close(ctx)

	jobs := make([]ReleaseJob, 0, limit)
	for cursor.Next(ctx) {
		var item mongoReleaseJob
		if decodeErr := cursor.Decode(&item); decodeErr != nil {
			return Dashboard{}, decodeErr
		}
		job := releaseJobFromMongo(item)
		if job.Manifest != nil && s.gitStore != nil {
			job.Manifest = s.enrichManifest(job.Manifest)
		}
		jobs = append(jobs, job)
	}
	if err := cursor.Err(); err != nil {
		return Dashboard{}, err
	}

	dashboard.Jobs = jobs
	return dashboard, nil
}

func (s *MongoStore) GetLiveState() (*LiveState, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var live mongoLiveState
	err := s.database.Collection(CollectionLiveState).FindOne(ctx, bson.M{"_id": "live"}).Decode(&live)
	if err == nil {
		return &LiveState{
			ID:               live.ID,
			LiveCommitSHA:    live.LiveCommitSHA,
			LastDeployJobID:  live.LastDeployJobID,
			LastSuccessfulAt: live.LastSuccessfulAt,
			PublicBaseURL:    live.PublicBaseURL,
			LivePointers:     live.LivePointers,
		}, nil
	}
	if errors.Is(err, mongo.ErrNoDocuments) {
		if s.publicBaseURL == nil {
			return nil, nil
		}
		return &LiveState{
			ID:            "live",
			PublicBaseURL: stringPtr(derefString(s.publicBaseURL)),
		}, nil
	}
	return nil, err
}

func (s *MongoStore) EnqueueDeploy(actor string, targetKey string) (ReleaseJob, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	targetKey = strings.TrimSpace(targetKey)
	if targetKey != "" {
		var existing mongoReleaseJob
		err := s.database.Collection(CollectionReleaseJobs).FindOne(
			ctx,
			bson.M{
				"status": bson.M{
					"$in": bson.A{
						ReleaseJobStatusQueued,
						ReleaseJobStatusDispatching,
						ReleaseJobStatusWaitingResult,
					},
				},
				"meta.target_key": targetKey,
			},
			options.FindOne().SetSort(bson.D{{Key: "created_at", Value: -1}}),
		).Decode(&existing)
		if err == nil {
			return releaseJobFromMongo(existing), nil
		}
		if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
			return ReleaseJob{}, err
		}
	}

	now := s.nowRFC3339()
	job := mongoReleaseJob{
		ID:          bson.NewObjectID().Hex(),
		Type:        ReleaseJobTypeDeploy,
		Status:      ReleaseJobStatusQueued,
		RequestedBy: normalizeActor(actor),
		Logs:        []string{"queued"},
		Meta: map[string]any{
			"target_key": targetKey,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := s.database.Collection(CollectionReleaseJobs).InsertOne(ctx, job); err != nil {
		return ReleaseJob{}, err
	}
	return releaseJobFromMongo(job), nil
}

func (s *MongoStore) ClaimNextDeploy() (*ReleaseJob, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := s.nowRFC3339()
	lockUpdate := bson.M{
		"$set": bson.M{
			"holder_job_id": deployLockClaiming,
			"updated_at":    now,
		},
		"$setOnInsert": bson.M{
			"_id":        deployLockID,
			"created_at": now,
		},
	}
	lockResult, err := s.database.Collection(CollectionDeployLocks).UpdateOne(
		ctx,
		bson.M{
			"_id": deployLockID,
			"$or": bson.A{
				bson.M{"holder_job_id": bson.M{"$exists": false}},
				bson.M{"holder_job_id": ""},
				bson.M{
					"holder_job_id": deployLockClaiming,
					"updated_at": bson.M{
						"$lt": s.now().Add(-30 * time.Second).UTC().Format(time.RFC3339),
					},
				},
			},
		},
		lockUpdate,
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return nil, err
	}
	if lockResult.MatchedCount == 0 && lockResult.ModifiedCount == 0 && lockResult.UpsertedCount == 0 {
		return nil, nil
	}

	var claimed mongoReleaseJob
	result := s.database.Collection(CollectionReleaseJobs).FindOneAndUpdate(
		ctx,
		bson.M{"status": ReleaseJobStatusQueued},
		bson.M{
			"$set": bson.M{
				"status":     ReleaseJobStatusDispatching,
				"started_at": now,
				"updated_at": now,
			},
			"$push": bson.M{
				"logs": "dispatching",
			},
		},
		options.FindOneAndUpdate().
			SetSort(bson.D{{Key: "created_at", Value: 1}}).
			SetReturnDocument(options.After),
	)
	if err := result.Err(); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			_ = s.releaseLock(ctx, deployLockClaiming)
			return nil, nil
		}
		_ = s.releaseLock(ctx, deployLockClaiming)
		return nil, err
	}
	if err := result.Decode(&claimed); err != nil {
		_ = s.releaseLock(ctx, deployLockClaiming)
		return nil, err
	}

	if _, err := s.database.Collection(CollectionDeployLocks).UpdateOne(
		ctx,
		bson.M{"_id": deployLockID, "holder_job_id": deployLockClaiming},
		bson.M{"$set": bson.M{"holder_job_id": claimed.ID, "updated_at": now}},
	); err != nil {
		return nil, err
	}

	job := releaseJobFromMongo(claimed)
	return &job, nil
}

func (s *MongoStore) GetActiveDeploy() (*ReleaseJob, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	holderID, err := s.lockHolderID(ctx)
	if err != nil || holderID == "" {
		return nil, err
	}

	var job mongoReleaseJob
	if err := s.database.Collection(CollectionReleaseJobs).FindOne(ctx, bson.M{"_id": holderID}).Decode(&job); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	result := releaseJobFromMongo(job)
	return &result, nil
}

func (s *MongoStore) GetRollbackSnapshot(jobID string) (*contentstore.PublishPointerSnapshot, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var job mongoReleaseJob
	if err := s.database.Collection(CollectionReleaseJobs).FindOne(ctx, bson.M{"_id": jobID}).Decode(&job); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	if job.RollbackSnapshot == nil {
		return nil, nil
	}
	snapshot := *job.RollbackSnapshot
	return &snapshot, nil
}

func (s *MongoStore) MarkActiveDeployPreparation(jobID string, rollback contentstore.PublishPointerSnapshot) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := s.nowRFC3339()
	_, err := s.database.Collection(CollectionReleaseJobs).UpdateOne(
		ctx,
		bson.M{"_id": jobID, "status": ReleaseJobStatusDispatching},
		bson.M{
			"$set": bson.M{
				"rollback_snapshot": rollback,
				"updated_at":        now,
			},
			"$push": bson.M{
				"logs": "captured_rollback_snapshot",
			},
		},
	)
	return err
}

func (s *MongoStore) UpdateActiveDeployDispatch(jobID string, commitSHA string, repoDir string, postCount int, projectCount int, manifest PublishManifest, rollback contentstore.PublishPointerSnapshot, deployHookURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := s.nowRFC3339()
	meta := map[string]any{
		"editorial_repo_dir": repoDir,
		"post_count":         postCount,
		"project_count":      projectCount,
	}
	logLine := "external_deploy_started"
	nextStatus := ReleaseJobStatusWaitingResult
	deployHookURL = strings.TrimSpace(deployHookURL)
	if deployHookURL != "" {
		meta["deploy_hook_url"] = deployHookURL
		meta["trigger_mode"] = "cloudflare_pages_deploy_hook"
	} else {
		meta["trigger_mode"] = "local_only"
		logLine = "local_deploy_ready"
		nextStatus = ReleaseJobStatusDispatching
	}

	_, err := s.database.Collection(CollectionReleaseJobs).UpdateOne(
		ctx,
		bson.M{"_id": jobID, "status": ReleaseJobStatusDispatching},
		bson.M{
			"$set": bson.M{
				"status":            nextStatus,
				"commit_sha":        stringPtr(strings.TrimSpace(commitSHA)),
				"manifest":          manifest,
				"rollback_snapshot": rollback,
				"meta":              meta,
				"updated_at":        now,
			},
			"$push": bson.M{
				"logs": logLine,
			},
		},
	)
	return err
}

func (s *MongoStore) CompleteActiveDeploySuccess(jobID string, live contentstore.PublishPointerSnapshot) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var job mongoReleaseJob
	if err := s.database.Collection(CollectionReleaseJobs).FindOne(ctx, bson.M{"_id": jobID}).Decode(&job); err != nil {
		return err
	}

	now := s.nowRFC3339()
	meta := cloneMap(job.Meta)
	if s.gitStore != nil && job.Manifest != nil && job.CommitSHA != nil {
		manifestYAML, err := encodeManifestYAML(*job.Manifest)
		if err != nil {
			meta["git_audit_error"] = err.Error()
		} else if err := s.gitStore.RecordDeploySuccess(job.RequestedBy, derefString(job.CommitSHA), derefStringString(meta["editorial_repo_dir"]), 0, 0, manifestYAML); err != nil {
			meta["git_audit_error"] = err.Error()
		}
	}

	_, err := s.database.Collection(CollectionReleaseJobs).UpdateOne(
		ctx,
		bson.M{"_id": jobID},
		bson.M{
			"$set": bson.M{
				"status":            ReleaseJobStatusSucceeded,
				"meta":              meta,
				"rollback_snapshot": nil,
				"completed_at":      now,
				"updated_at":        now,
			},
			"$push": bson.M{
				"logs": "deployment_succeeded",
			},
		},
	)
	if err != nil {
		return err
	}

	_, err = s.database.Collection(CollectionLiveState).UpdateOne(
		ctx,
		bson.M{"_id": "live"},
		bson.M{
			"$set": bson.M{
				"live_commit_sha":    strings.TrimSpace(derefString(job.CommitSHA)),
				"last_deploy_job_id": job.ID,
				"last_successful_at": now,
				"public_base_url":    stringPtr(derefString(s.publicBaseURL)),
				"live_pointers":      live,
			},
			"$setOnInsert": bson.M{"_id": "live"},
		},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return err
	}
	return s.releaseLock(ctx, jobID)
}

func (s *MongoStore) CompleteActiveDeployFailure(jobID string, reason string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	now := s.nowRFC3339()
	_, err := s.database.Collection(CollectionReleaseJobs).UpdateOne(
		ctx,
		bson.M{"_id": jobID},
		bson.M{
			"$set": bson.M{
				"status":            ReleaseJobStatusFailed,
				"rollback_snapshot": nil,
				"completed_at":      now,
				"updated_at":        now,
			},
			"$push": bson.M{
				"logs": strings.TrimSpace(reason),
			},
		},
	)
	if err != nil {
		return err
	}
	return s.releaseLock(ctx, jobID)
}

func (s *MongoStore) enrichManifest(manifest *PublishManifest) *PublishManifest {
	if manifest == nil || s.gitStore == nil {
		return manifest
	}
	copyManifest := *manifest
	if manifest.Changes == nil {
		return &copyManifest
	}
	copyManifest.Changes = append([]PublishManifestChange{}, manifest.Changes...)
	for index := range copyManifest.Changes {
		change := copyManifest.Changes[index]
		fromMetadata, fromBody := s.gitStore.loadSnapshotParts(change, strings.TrimSpace(derefString(change.From)))
		toMetadata, toBody := s.gitStore.loadSnapshotParts(change, strings.TrimSpace(derefString(change.To)))
		copyManifest.Changes[index].FromMetadata = fromMetadata
		copyManifest.Changes[index].ToMetadata = toMetadata
		copyManifest.Changes[index].FromBody = fromBody
		copyManifest.Changes[index].ToBody = toBody
		copyManifest.Changes[index].Diff = s.gitStore.loadChangeDiff(change)
		copyManifest.Changes[index].Commits = s.gitStore.listChangeCommits(change)
	}
	return &copyManifest
}

func (s *MongoStore) releaseLock(ctx context.Context, holderID string) error {
	filter := bson.M{"_id": deployLockID}
	holderID = strings.TrimSpace(holderID)
	if holderID != "" {
		filter["holder_job_id"] = holderID
	}
	_, err := s.database.Collection(CollectionDeployLocks).UpdateOne(
		ctx,
		filter,
		bson.M{
			"$unset": bson.M{"holder_job_id": ""},
			"$set":   bson.M{"updated_at": s.nowRFC3339()},
		},
	)
	return err
}

func (s *MongoStore) lockHolderID(ctx context.Context) (string, error) {
	var lock mongoDeployLock
	err := s.database.Collection(CollectionDeployLocks).FindOne(ctx, bson.M{"_id": deployLockID}).Decode(&lock)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return "", nil
		}
		return "", err
	}
	return strings.TrimSpace(derefString(lock.HolderJobID)), nil
}

func (s *MongoStore) nowRFC3339() string {
	return s.now().UTC().Format(time.RFC3339)
}

func releaseJobFromMongo(item mongoReleaseJob) ReleaseJob {
	return ReleaseJob{
		ID:          item.ID,
		Type:        item.Type,
		Status:      item.Status,
		CommitSHA:   item.CommitSHA,
		RequestedBy: item.RequestedBy,
		Logs:        append([]string{}, item.Logs...),
		Meta:        cloneMap(item.Meta),
		Manifest:    item.Manifest,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
		StartedAt:   item.StartedAt,
		CompletedAt: item.CompletedAt,
	}
}

func encodeManifestYAML(manifest PublishManifest) (string, error) {
	body, err := yaml.Marshal(manifest)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(body)), nil
}

func derefStringString(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}
