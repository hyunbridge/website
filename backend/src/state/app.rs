use super::*;

impl AppState {
    pub async fn new(config: crate::config::AppConfig) -> Result<Self, AppInitError> {
        let (database, http_client, repo) = prepare_dependencies(&config).await?;

        let store = ContentStore::new(database);
        if store
            .load_data()
            .await
            .map_err(|err| AppInitError::new(err.to_string()))?
            .is_none()
        {
            return Err(AppInitError::new(
                "backend state is not initialized; run `cargo run -- init-admin --admin-email <email> --admin-password-stdin` first",
            ));
        }
        store
            .reconcile_editorial_state(&repo)
            .await
            .map_err(|err| AppInitError::new(err.to_string()))?;

        Ok(Self {
            config,
            http_client,
            repo: Some(repo),
            store,
        })
    }

    pub async fn install_admin(
        config: crate::config::AppConfig,
        admin_email: &str,
        admin_password: &str,
    ) -> Result<(), AppInitError> {
        let (database, _http_client, repo) = prepare_dependencies(&config).await?;
        let store = ContentStore::new(database);

        if store
            .load_data()
            .await
            .map_err(|err| AppInitError::new(err.to_string()))?
            .is_some()
        {
            return Err(AppInitError::new("backend state is already initialized"));
        }

        let seeded = seed_persisted_data(admin_email, admin_password)
            .map_err(|err| AppInitError::new(err.to_string()))?;
        store
            .save_data(&seeded)
            .await
            .map_err(|err| AppInitError::new(err.to_string()))?;
        store
            .reconcile_editorial_state(&repo)
            .await
            .map_err(|err| AppInitError::new(err.to_string()))?;
        Ok(())
    }
}

async fn prepare_dependencies(
    config: &crate::config::AppConfig,
) -> Result<(Database, reqwest::Client, ContentRepo), AppInitError> {
    let mongo_client = Client::with_uri_str(&config.mongo_url)
        .await
        .map_err(|err| AppInitError::new(format!("connect mongo: {err}")))?;
    let database = mongo_client.database(&config.mongo_database_name);
    database
        .run_command(doc! { "ping": 1_i32 })
        .await
        .map_err(|err| AppInitError::new(format!("ping mongo: {err}")))?;

    let http_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|err| AppInitError::new(format!("build http client: {err}")))?;
    let repo = ContentRepo::from_config(config)
        .ok_or_else(|| AppInitError::new("content repository is not configured"))?;
    repo.ensure_ready()
        .map_err(|err| AppInitError::new(format!("init content repo: {err}")))?;

    Ok((database, http_client, repo))
}
