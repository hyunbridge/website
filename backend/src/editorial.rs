use serde::{Deserialize, Serialize};
use serde::{Deserializer, Serializer};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitMetadata {
    pub schema_version: i32,
    pub kind: String,
    #[serde(default)]
    pub document_id: String,
    #[serde(default)]
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagDoc {
    pub id: String,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkDoc {
    pub id: Option<String>,
    pub label: String,
    pub url: String,
    #[serde(rename = "linkType")]
    pub link_type: Option<String>,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorialPostDocument {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    #[serde(
        rename = "publishedAt",
        default,
        serialize_with = "serialize_empty_string_as_null",
        deserialize_with = "deserialize_null_or_string_default"
    )]
    pub published_at: String,
    #[serde(rename = "coverImage", default)]
    pub cover_image: Option<String>,
    #[serde(rename = "enableComments", default)]
    pub enable_comments: bool,
    #[serde(default)]
    pub tags: Vec<TagDoc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorialProjectDocument {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    #[serde(
        rename = "publishedAt",
        default,
        serialize_with = "serialize_empty_string_as_null",
        deserialize_with = "deserialize_null_or_string_default"
    )]
    pub published_at: String,
    #[serde(rename = "coverImage", default)]
    pub cover_image: Option<String>,
    #[serde(rename = "sortOrder", default)]
    pub sort_order: i32,
    #[serde(default)]
    pub tags: Vec<TagDoc>,
    #[serde(default)]
    pub links: Vec<LinkDoc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorialHomeSnapshot {
    pub id: String,
    pub title: String,
    pub data: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(
        rename = "published_at",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub published_at: Option<String>,
}

pub fn build_commit_body(kind: &str, document_id: &str, title: &str) -> Result<String, String> {
    serde_norway::to_string(&CommitMetadata {
        schema_version: 1,
        kind: kind.trim().to_owned(),
        document_id: document_id.trim().to_owned(),
        title: title.trim().to_owned(),
    })
    .map(|body| body.trim().to_owned())
    .map_err(|err| err.to_string())
}

pub fn parse_commit_body(body: &str) -> Option<CommitMetadata> {
    let body = body.trim();
    if body.is_empty() {
        return None;
    }
    let parsed: CommitMetadata = serde_norway::from_str(body).ok()?;
    if parsed.schema_version != 1 || parsed.kind.trim().is_empty() {
        return None;
    }
    Some(parsed)
}

pub fn build_editorial_post_markdown(
    doc: &EditorialPostDocument,
    body_markdown: &str,
) -> Result<String, String> {
    build_markdown_frontmatter(doc, body_markdown)
}

pub fn build_editorial_project_markdown(
    doc: &EditorialProjectDocument,
    body_markdown: &str,
) -> Result<String, String> {
    build_markdown_frontmatter(doc, body_markdown)
}

pub fn parse_editorial_post_markdown(
    payload: &[u8],
) -> Result<(EditorialPostDocument, String), String> {
    let (frontmatter, body) = parse_markdown_document(payload)?;
    serde_norway::from_str::<EditorialPostDocument>(&frontmatter)
        .map(|doc| (doc, body))
        .map_err(|err| err.to_string())
}

pub fn parse_editorial_project_markdown(
    payload: &[u8],
) -> Result<(EditorialProjectDocument, String), String> {
    let (frontmatter, body) = parse_markdown_document(payload)?;
    serde_norway::from_str::<EditorialProjectDocument>(&frontmatter)
        .map(|doc| (doc, body))
        .map_err(|err| err.to_string())
}

fn build_markdown_frontmatter<T: Serialize>(
    doc: &T,
    body_markdown: &str,
) -> Result<String, String> {
    let frontmatter = serde_norway::to_string(doc).map_err(|err| err.to_string())?;
    let body = body_markdown.replace("\r\n", "\n").trim().to_owned();
    Ok(format!("---\n{}---\n\n{}\n", frontmatter, body))
}

fn parse_markdown_document(payload: &[u8]) -> Result<(String, String), String> {
    let content = String::from_utf8_lossy(payload).replace("\r\n", "\n");
    let Some(rest) = content.strip_prefix("---\n") else {
        return Err("markdown document is missing frontmatter".to_owned());
    };
    let Some((frontmatter, body)) = rest.split_once("\n---\n") else {
        return Err("markdown document has invalid frontmatter".to_owned());
    };
    Ok((frontmatter.to_owned(), body.trim().to_owned()))
}

fn serialize_empty_string_as_null<S>(value: &str, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    if value.trim().is_empty() {
        serializer.serialize_none()
    } else {
        serializer.serialize_str(value)
    }
}

fn deserialize_null_or_string_default<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Option::<String>::deserialize(deserializer)?;
    Ok(value.unwrap_or_default())
}
