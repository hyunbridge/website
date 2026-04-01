use super::*;

impl AppState {
    pub async fn authenticate_admin(
        &self,
        email: &str,
        password: &str,
    ) -> Result<Option<AdminProfile>, ApiError> {
        self.store.authenticate_primary_admin(email, password).await
    }

    pub async fn admin_me(
        &self,
        actor: &crate::models::AdminActor,
    ) -> Result<AdminProfile, ApiError> {
        self.store.resolve_admin_profile(actor).await
    }

    pub async fn update_admin_profile(
        &self,
        actor: &crate::models::AdminActor,
        request: UpdateProfileRequest,
    ) -> Result<HashMap<&'static str, serde_json::Value>, ApiError> {
        let profile = self.store.update_admin_profile(actor, request).await?;
        Ok(profile_payload(&profile))
    }

    pub async fn update_admin_password(
        &self,
        current_password: &str,
        next_password: &str,
    ) -> Result<(), ApiError> {
        self.store
            .update_primary_admin_password(current_password, next_password)
            .await
    }
}

impl ContentStore {
    pub(crate) async fn resolve_git_author_identity(
        &self,
        actor_id: &str,
    ) -> Result<(String, String), ApiError> {
        let actor_id = actor_id.trim();
        if !actor_id.is_empty()
            && let Some(profile) = self.find_admin_profile_by_actor_id(actor_id).await?
        {
            return Ok((
                default_git_author_name(&profile),
                default_git_author_email(&profile),
            ));
        }
        if let Some(profile) = self.load_primary_admin().await? {
            return Ok((
                default_git_author_name(&profile),
                default_git_author_email(&profile),
            ));
        }
        let profile = self.load_or_seedless_data().await?.admin_profile;
        Ok((
            default_git_author_name(&profile),
            default_git_author_email(&profile),
        ))
    }

    pub(crate) async fn resolve_git_author_identity_for_actor(
        &self,
        actor: &crate::models::AdminActor,
    ) -> Result<(String, String), ApiError> {
        let actor_id = actor.user_id.trim();
        if !actor_id.is_empty()
            && let Some(profile) = self.find_admin_profile_by_actor_id(actor_id).await?
        {
            return Ok((
                default_git_author_name(&profile),
                default_git_author_email(&profile),
            ));
        }
        if let Some(identity) = fallback_git_author_identity(actor) {
            return Ok(identity);
        }
        if let Some(profile) = self.load_primary_admin().await? {
            return Ok((
                default_git_author_name(&profile),
                default_git_author_email(&profile),
            ));
        }
        let profile = self.load_or_seedless_data().await?.admin_profile;
        Ok((
            default_git_author_name(&profile),
            default_git_author_email(&profile),
        ))
    }

    async fn authenticate_primary_admin(
        &self,
        email: &str,
        password: &str,
    ) -> Result<Option<AdminProfile>, ApiError> {
        let profile = self.load_primary_admin().await?.filter(|profile| {
            profile.email == email && compare_admin_password(&profile.password, password)
        });
        Ok(profile.map(Into::into))
    }

    async fn resolve_admin_profile(
        &self,
        actor: &crate::models::AdminActor,
    ) -> Result<AdminProfile, ApiError> {
        if actor.auth_type == "bridge" {
            return self
                .get_or_create_identity_profile(&actor.user_id, &actor.email)
                .await
                .map(Into::into);
        }
        self.load_primary_admin()
            .await?
            .map(Into::into)
            .ok_or_else(|| ApiError::internal("failed_to_load_profile"))
    }

    async fn update_admin_profile(
        &self,
        actor: &crate::models::AdminActor,
        request: UpdateProfileRequest,
    ) -> Result<AdminProfile, ApiError> {
        if actor.auth_type == "bridge" {
            return self
                .upsert_identity_profile(&actor.user_id, &actor.email, request)
                .await
                .map(Into::into);
        }

        let mut data = self.load_or_seedless_data().await?;
        data.admin_profile.full_name = trim_optional_owned(request.full_name);
        data.admin_profile.avatar_url = trim_optional_owned(request.avatar_url);
        data.admin_profile.git_author_name = trim_optional_owned(request.git_author_name);
        data.admin_profile.git_author_email = trim_optional_owned(request.git_author_email);
        self.save_data(&data).await?;
        Ok(data.admin_profile.into())
    }

    async fn update_primary_admin_password(
        &self,
        current_password: &str,
        next_password: &str,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        if !compare_admin_password(&data.admin_profile.password, current_password) {
            return Err(ApiError::unauthorized("invalid_current_password"));
        }
        data.admin_profile.password = hash_admin_password(next_password)
            .map_err(|_| ApiError::internal("failed_to_update_password"))?;
        self.save_data(&data).await?;
        Ok(())
    }

    async fn find_admin_profile_by_actor_id(
        &self,
        actor_id: &str,
    ) -> Result<Option<PersistedAdminProfile>, ApiError> {
        let actor_id = actor_id.trim();
        if actor_id.is_empty() {
            return Ok(None);
        }

        if let Some(profile) = self.load_primary_admin().await?
            && profile.id.trim() == actor_id
        {
            return Ok(Some(profile));
        }

        let document = self
            .users
            .find_one(doc! {
                "$or": [
                    { "_id": actor_id },
                    { "id": actor_id },
                ]
            })
            .await
            .map_err(|err| ApiError::internal(format!("failed_to_load_profile: {err}")))?;
        document.map(parse_admin_profile_document).transpose()
    }
}

fn profile_payload(profile: &AdminProfile) -> HashMap<&'static str, serde_json::Value> {
    let mut payload = HashMap::new();
    payload.insert("username", serde_json::json!(profile.username));
    payload.insert("full_name", serde_json::json!(profile.full_name));
    payload.insert("avatar_url", serde_json::json!(profile.avatar_url));
    payload.insert("email", serde_json::json!(profile.email));
    payload.insert(
        "git_author_name",
        serde_json::json!(profile.git_author_name),
    );
    payload.insert(
        "git_author_email",
        serde_json::json!(profile.git_author_email),
    );
    payload
}

pub(crate) fn default_git_author_name(profile: &PersistedAdminProfile) -> String {
    [
        profile.git_author_name.as_deref(),
        profile.full_name.as_deref(),
        Some(profile.username.as_str()),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|value| !value.is_empty())
    .unwrap_or_default()
    .to_owned()
}

pub(crate) fn default_git_author_email(profile: &PersistedAdminProfile) -> String {
    [
        profile.git_author_email.as_deref(),
        Some(profile.email.as_str()),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|value| !value.is_empty())
    .unwrap_or_default()
    .to_owned()
}

fn fallback_git_author_identity(actor: &crate::models::AdminActor) -> Option<(String, String)> {
    if actor.auth_type.trim() != "bridge" {
        return None;
    }
    let email = actor.email.trim();
    if email.is_empty() {
        return None;
    }
    Some((email.to_owned(), email.to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_git_author_identity_preserves_bridge_email() {
        let actor = crate::models::AdminActor {
            user_id: "bridge-user".to_owned(),
            email: "bridge@example.com".to_owned(),
            auth_type: "bridge".to_owned(),
        };

        assert_eq!(
            fallback_git_author_identity(&actor),
            Some((
                "bridge@example.com".to_owned(),
                "bridge@example.com".to_owned()
            ))
        );
    }

    #[test]
    fn fallback_git_author_identity_skips_non_bridge_actor() {
        let actor = crate::models::AdminActor {
            user_id: "admin".to_owned(),
            email: "admin@example.com".to_owned(),
            auth_type: "password".to_owned(),
        };

        assert_eq!(fallback_git_author_identity(&actor), None);
    }
}
