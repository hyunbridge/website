package objectstorage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/hyunbridge/website/backend/internal/config"
)

var objectStorageHTTPClient = &http.Client{Timeout: 30 * time.Second}

type Client struct {
	cfg           config.Config
	client        *s3.Client
	presignClient *s3.PresignClient
}

type PutObjectInput struct {
	Key                string
	Body               []byte
	ContentType        string
	ContentDisposition string
	CacheControl       string
	Metadata           map[string]string
}

func New(cfg config.Config) Client {
	client := Client{cfg: cfg}
	if !client.IsConfigured() {
		return client
	}

	awsCfg := aws.Config{
		Region:      cfg.S3Region,
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")),
		HTTPClient:  objectStorageHTTPClient,
	}

	s3Client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.UsePathStyle = true
		options.BaseEndpoint = aws.String(strings.TrimSuffix(cfg.S3Endpoint, "/"))
	})

	client.client = s3Client
	client.presignClient = s3.NewPresignClient(s3Client)
	return client
}

func (c Client) IsConfigured() bool {
	return c.cfg.S3Bucket != "" && c.cfg.S3Endpoint != "" && c.cfg.S3AccessKey != "" && c.cfg.S3SecretKey != ""
}

func (c Client) PublicURL(key string) string {
	base := strings.TrimSuffix(c.cfg.S3PublicBaseURL, "/")
	if base != "" {
		return base + "/" + strings.TrimPrefix(key, "/")
	}

	base = strings.TrimSuffix(c.cfg.S3Endpoint, "/")
	return base + "/" + strings.TrimPrefix(c.cfg.S3Bucket, "/") + "/" + strings.TrimPrefix(key, "/")
}

func (c Client) PresignPutObject(key, contentType string, expires time.Duration) (string, error) {
	if err := c.ensureReady(); err != nil {
		return "", err
	}

	presigned, err := c.presignClient.PresignPutObject(
		context.Background(),
		&s3.PutObjectInput{
			Bucket:      aws.String(c.cfg.S3Bucket),
			Key:         aws.String(normalizeKey(key)),
			ContentType: aws.String(contentType),
			ACL:         types.ObjectCannedACLPublicRead,
		},
		func(options *s3.PresignOptions) {
			options.Expires = expires
		},
	)
	if err != nil {
		return "", err
	}

	return presigned.URL, nil
}

func (c Client) DeleteObjects(keys []string) error {
	if err := c.ensureReady(); err != nil {
		return err
	}

	objects := make([]types.ObjectIdentifier, 0, len(keys))
	for _, key := range keys {
		normalized := normalizeKey(key)
		if normalized == "" {
			continue
		}
		objects = append(objects, types.ObjectIdentifier{Key: aws.String(normalized)})
	}
	if len(objects) == 0 {
		return nil
	}

	result, err := c.client.DeleteObjects(context.Background(), &s3.DeleteObjectsInput{
		Bucket: aws.String(c.cfg.S3Bucket),
		Delete: &types.Delete{
			Objects: objects,
			Quiet:   aws.Bool(true),
		},
	})
	if err != nil {
		return err
	}
	if len(result.Errors) > 0 {
		first := result.Errors[0]
		return fmt.Errorf(
			"delete object failed for %s: %s",
			aws.ToString(first.Key),
			aws.ToString(first.Message),
		)
	}

	return nil
}

func (c Client) ObjectExists(key string) (bool, error) {
	if err := c.ensureReady(); err != nil {
		return false, err
	}

	_, err := c.client.HeadObject(context.Background(), &s3.HeadObjectInput{
		Bucket: aws.String(c.cfg.S3Bucket),
		Key:    aws.String(normalizeKey(key)),
	})
	if err == nil {
		return true, nil
	}

	var responseErr *smithyhttp.ResponseError
	if errors.As(err, &responseErr) && responseErr.HTTPStatusCode() == http.StatusNotFound {
		return false, nil
	}

	return false, err
}

func (c Client) PutObject(input PutObjectInput) error {
	if err := c.ensureReady(); err != nil {
		return err
	}

	metadata := make(map[string]string, len(input.Metadata))
	for key, value := range input.Metadata {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		metadata[trimmedKey] = trimmedValue
	}

	_, err := c.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:             aws.String(c.cfg.S3Bucket),
		Key:                aws.String(normalizeKey(input.Key)),
		Body:               bytes.NewReader(input.Body),
		ContentType:        aws.String(input.ContentType),
		ContentDisposition: optionalString(input.ContentDisposition),
		CacheControl:       optionalString(input.CacheControl),
		Metadata:           metadata,
		ACL:                types.ObjectCannedACLPublicRead,
	})

	return err
}

func (c Client) ensureReady() error {
	if !c.IsConfigured() || c.client == nil || c.presignClient == nil {
		return fmt.Errorf("object storage is not configured")
	}
	return nil
}

func normalizeKey(key string) string {
	return strings.TrimPrefix(strings.TrimSpace(key), "/")
}

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return aws.String(trimmed)
}
