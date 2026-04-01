use super::*;

impl ContentStore {
    pub(super) async fn get_or_create_identity_profile(
        &self,
        user_id: &str,
        email: &str,
    ) -> Result<PersistedAdminProfile, ApiError> {
        let user_id = user_id.trim();
        let email = email.trim();
        if user_id.is_empty() {
            return Err(ApiError::internal("user id is required"));
        }
        if email.is_empty() {
            return Err(ApiError::internal("email is required"));
        }

        let now = now_rfc3339();
        let update = doc! {
            "$set": {
                "email": email,
                "updated_at": &now,
            },
            "$setOnInsert": {
                "id": user_id,
                "username": user_id,
                "password": "",
                "created_at": &now,
            },
        };

        self.users
            .update_one(doc! { "_id": user_id }, update)
            .upsert(true)
            .await
            .map_err(|err| ApiError::internal(format!("failed_to_load_profile: {err}")))?;

        let document = self
            .users
            .find_one(doc! { "_id": user_id })
            .await
            .map_err(|err| ApiError::internal(format!("failed_to_load_profile: {err}")))?
            .ok_or_else(|| ApiError::internal("failed_to_load_profile"))?;
        parse_admin_profile_document(document)
    }

    pub(super) async fn upsert_identity_profile(
        &self,
        user_id: &str,
        email: &str,
        request: UpdateProfileRequest,
    ) -> Result<PersistedAdminProfile, ApiError> {
        let user_id = user_id.trim();
        let email = email.trim();
        if user_id.is_empty() {
            return Err(ApiError::internal("user id is required"));
        }
        if email.is_empty() {
            return Err(ApiError::internal("email is required"));
        }

        let now = now_rfc3339();
        let mut set = doc! {
            "email": email,
            "updated_at": &now,
        };
        if let Some(value) = request.full_name {
            set.insert("full_name", value);
        }
        if let Some(value) = request.avatar_url {
            set.insert("avatar_url", value);
        }
        if let Some(value) = request.git_author_name {
            set.insert("git_author_name", value.trim().to_owned());
        }
        if let Some(value) = request.git_author_email {
            set.insert("git_author_email", value.trim().to_owned());
        }

        let update = doc! {
            "$set": set,
            "$setOnInsert": {
                "id": user_id,
                "username": user_id,
                "password": "",
                "created_at": &now,
            },
        };

        self.users
            .update_one(doc! { "_id": user_id }, update)
            .upsert(true)
            .await
            .map_err(|err| ApiError::internal(format!("failed_to_update_profile: {err}")))?;

        let document = self
            .users
            .find_one(doc! { "_id": user_id })
            .await
            .map_err(|err| ApiError::internal(format!("failed_to_update_profile: {err}")))?
            .ok_or_else(|| ApiError::internal("failed_to_update_profile"))?;
        parse_admin_profile_document(document)
    }
}
