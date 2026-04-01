use std::collections::HashMap;
use std::time::Duration;

use aws_credential_types::Credentials;
use aws_sdk_s3::Client;
use aws_sdk_s3::config::{Builder, Region};
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::types::{Delete, ObjectCannedAcl, ObjectIdentifier};

use crate::config::AppConfig;

#[derive(Clone)]
pub struct ObjectStorage {
    config: AppConfig,
    client: Option<Client>,
}

#[derive(Debug, Clone, Default)]
pub struct PutObjectInput {
    pub key: String,
    pub body: Vec<u8>,
    pub content_type: String,
    pub content_disposition: String,
    pub cache_control: String,
    pub metadata: HashMap<String, String>,
}

impl ObjectStorage {
    pub fn new(config: &AppConfig) -> Self {
        let client = if is_configured(config) {
            let credentials = Credentials::new(
                config.s3_access_key.clone(),
                config.s3_secret_key.clone(),
                None,
                None,
                "static",
            );
            let mut builder = Builder::new()
                .region(Region::new(config.s3_region.clone()))
                .credentials_provider(credentials);
            if !config.s3_endpoint.trim().is_empty() {
                builder = builder
                    .endpoint_url(config.s3_endpoint.trim())
                    .force_path_style(true);
            }
            Some(Client::from_conf(builder.build()))
        } else {
            None
        };

        Self {
            config: config.clone(),
            client,
        }
    }

    pub fn is_configured(&self) -> bool {
        is_configured(&self.config) && self.client.is_some()
    }

    pub fn public_url(&self, key: &str) -> Result<String, String> {
        let base = if !self.config.s3_public_base_url.trim().is_empty() {
            self.config
                .s3_public_base_url
                .trim()
                .trim_end_matches('/')
                .to_owned()
        } else if !self.config.s3_endpoint.trim().is_empty()
            && !self.config.s3_bucket.trim().is_empty()
        {
            format!(
                "{}/{}",
                self.config.s3_endpoint.trim().trim_end_matches('/'),
                self.config.s3_bucket.trim().trim_start_matches('/'),
            )
        } else {
            return Err("object storage is not configured".to_owned());
        };
        Ok(format!("{}/{}", base, key.trim_start_matches('/')))
    }

    pub async fn presign_put_object(
        &self,
        key: &str,
        content_type: &str,
        expires: Duration,
    ) -> Result<String, String> {
        let client = self
            .client
            .as_ref()
            .ok_or_else(|| "object storage is not configured".to_owned())?;
        let config = PresigningConfig::expires_in(expires).map_err(|err| err.to_string())?;
        client
            .put_object()
            .bucket(self.config.s3_bucket.trim())
            .key(normalize_key(key))
            .content_type(content_type)
            .acl(ObjectCannedAcl::PublicRead)
            .presigned(config)
            .await
            .map(|request| request.uri().to_string())
            .map_err(|err| err.to_string())
    }

    pub async fn delete_objects(&self, keys: &[String]) -> Result<(), String> {
        let client = self
            .client
            .as_ref()
            .ok_or_else(|| "object storage is not configured".to_owned())?;
        let objects: Vec<ObjectIdentifier> = keys
            .iter()
            .map(|key| {
                ObjectIdentifier::builder()
                    .key(normalize_key(key))
                    .build()
                    .map_err(|err| err.to_string())
            })
            .collect::<Result<Vec<_>, _>>()?;
        if objects.is_empty() {
            return Ok(());
        }
        let delete = Delete::builder()
            .set_objects(Some(objects))
            .quiet(true)
            .build()
            .map_err(|err| err.to_string())?;

        client
            .delete_objects()
            .bucket(self.config.s3_bucket.trim())
            .delete(delete)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    pub async fn object_exists(&self, key: &str) -> Result<bool, String> {
        let client = self
            .client
            .as_ref()
            .ok_or_else(|| "object storage is not configured".to_owned())?;
        match client
            .head_object()
            .bucket(self.config.s3_bucket.trim())
            .key(normalize_key(key))
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(err) => {
                let message = err.to_string();
                if message.contains("NotFound") || message.contains("404") {
                    Ok(false)
                } else {
                    Err(message)
                }
            }
        }
    }

    pub async fn put_object(&self, input: PutObjectInput) -> Result<(), String> {
        let client = self
            .client
            .as_ref()
            .ok_or_else(|| "object storage is not configured".to_owned())?;
        let mut metadata = HashMap::new();
        for (key, value) in input.metadata {
            let key = key.trim().to_owned();
            let value = value.trim().to_owned();
            if key.is_empty() || value.is_empty() {
                continue;
            }
            metadata.insert(key, value);
        }

        let mut request = client
            .put_object()
            .bucket(self.config.s3_bucket.trim())
            .key(normalize_key(&input.key))
            .body(ByteStream::from(input.body))
            .content_type(input.content_type)
            .acl(ObjectCannedAcl::PublicRead);
        if !input.content_disposition.trim().is_empty() {
            request = request.content_disposition(input.content_disposition);
        }
        if !input.cache_control.trim().is_empty() {
            request = request.cache_control(input.cache_control);
        }
        if !metadata.is_empty() {
            request = request.set_metadata(Some(metadata));
        }
        request.send().await.map_err(|err| err.to_string())?;
        Ok(())
    }
}

fn is_configured(config: &AppConfig) -> bool {
    !config.s3_bucket.trim().is_empty()
        && !config.s3_endpoint.trim().is_empty()
        && !config.s3_access_key.trim().is_empty()
        && !config.s3_secret_key.trim().is_empty()
}

fn normalize_key(key: &str) -> String {
    key.trim().trim_start_matches('/').to_owned()
}
