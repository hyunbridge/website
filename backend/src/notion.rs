use std::collections::HashSet;

use serde_json::{Map, Value, json};

const API_BASE_URL: &str = "https://www.notion.so/api/v3";

#[derive(Clone)]
pub struct NotionClient {
    http_client: reqwest::Client,
}

impl NotionClient {
    pub fn new(http_client: reqwest::Client) -> Self {
        Self { http_client }
    }

    pub async fn get_page(&self, page_ref: &str) -> Result<Value, String> {
        let page_id = parse_page_id(page_ref)?;

        let page_chunk = self
            .post(
                "loadPageChunk",
                json!({
                    "pageId": page_id,
                    "limit": 100,
                    "chunkNumber": 0,
                    "cursor": { "stack": [] },
                    "verticalColumns": false,
                }),
            )
            .await?;

        let mut record_map = page_chunk
            .get("recordMap")
            .and_then(Value::as_object)
            .cloned()
            .ok_or_else(|| "notion page not found".to_owned())?;
        let has_blocks = record_map
            .get("block")
            .and_then(Value::as_object)
            .map(|block| !block.is_empty())
            .unwrap_or(false);
        if !has_blocks {
            return Err("notion page not found".to_owned());
        }

        ensure_object_field(&mut record_map, "collection");
        ensure_object_field(&mut record_map, "collection_view");
        ensure_object_field(&mut record_map, "notion_user");
        ensure_object_field(&mut record_map, "collection_query");
        ensure_object_field(&mut record_map, "signed_urls");

        loop {
            let pending = pending_block_ids(&record_map, &page_id);
            if pending.is_empty() {
                break;
            }

            let requests: Vec<Value> = pending
                .iter()
                .map(|block_id| {
                    json!({
                        "table": "block",
                        "id": block_id,
                        "version": -1,
                    })
                })
                .collect();
            let blocks_response = self
                .post("syncRecordValuesMain", json!({ "requests": requests }))
                .await?;
            let Some(next_blocks) = blocks_response
                .get("recordMap")
                .and_then(Value::as_object)
                .and_then(|record_map| record_map.get("block"))
                .and_then(Value::as_object)
            else {
                break;
            };
            if next_blocks.is_empty() {
                break;
            }

            let block_map = ensure_object_field(&mut record_map, "block");
            merge_maps(block_map, next_blocks);
        }

        self.add_signed_urls(&mut record_map, &page_id).await;
        Ok(Value::Object(record_map))
    }

    async fn add_signed_urls(&self, record_map: &mut Map<String, Value>, page_id: &str) {
        let Some(block_map) = record_map.get("block").and_then(Value::as_object) else {
            return;
        };

        let mut request_ids = Vec::new();
        let mut requests = Vec::new();
        for block_id in content_block_ids(record_map, page_id) {
            let Some(block) = block_map.get(&block_id) else {
                continue;
            };
            let Some(block_obj) = unwrap_value(block).as_object() else {
                continue;
            };
            let Some(source) = signed_url_source(block_obj) else {
                continue;
            };

            requests.push(json!({
                "permissionRecord": {
                    "table": "block",
                    "id": block_obj
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or(block_id.as_str()),
                },
                "url": source,
            }));
            request_ids.push(block_id);
        }

        if requests.is_empty() {
            return;
        }

        let response = match self
            .post("getSignedFileUrls", json!({ "urls": requests }))
            .await
        {
            Ok(response) => response,
            Err(_) => return,
        };

        let Some(signed_urls) = response.get("signedUrls").and_then(Value::as_array) else {
            return;
        };
        let target = ensure_object_field(record_map, "signed_urls");
        for (index, signed_url) in signed_urls.iter().enumerate() {
            let Some(url) = signed_url.as_str() else {
                continue;
            };
            if url.is_empty() {
                continue;
            }
            if let Some(block_id) = request_ids.get(index) {
                target.insert(block_id.clone(), Value::String(url.to_owned()));
            }
        }
    }

    async fn post(&self, endpoint: &str, body: Value) -> Result<Value, String> {
        let response = self
            .http_client
            .post(format!("{API_BASE_URL}/{endpoint}"))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|err| err.to_string())?;

        let status = response.status();
        if status.is_client_error() || status.is_server_error() {
            return Err(format!(
                "notion api {endpoint} returned {}",
                status.as_u16()
            ));
        }

        response
            .json::<Value>()
            .await
            .map_err(|err| err.to_string())
    }
}

pub fn parse_page_id(value: &str) -> Result<String, String> {
    let candidate = value
        .trim()
        .split('?')
        .next()
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if candidate.is_empty() {
        return Err("invalid notion page id".to_owned());
    }

    if let Some(raw) = extract_hex_run(&candidate, 32) {
        return Ok(id_to_uuid(&raw));
    }
    if let Some(uuid) = extract_uuid(&candidate) {
        return Ok(uuid);
    }

    Err("invalid notion page id".to_owned())
}

fn pending_block_ids(record_map: &Map<String, Value>, page_id: &str) -> Vec<String> {
    let Some(block_map) = record_map.get("block").and_then(Value::as_object) else {
        return Vec::new();
    };

    content_block_ids(record_map, page_id)
        .into_iter()
        .filter(|block_id| !block_map.contains_key(block_id))
        .collect()
}

fn content_block_ids(record_map: &Map<String, Value>, page_id: &str) -> Vec<String> {
    let Some(block_map) = record_map.get("block").and_then(Value::as_object) else {
        return Vec::new();
    };
    let root_block_id = if block_map.contains_key(page_id) {
        page_id.to_owned()
    } else {
        block_map.keys().next().cloned().unwrap_or_default()
    };
    if root_block_id.is_empty() {
        return Vec::new();
    }

    let mut seen = HashSet::new();
    walk_block(&root_block_id, &root_block_id, block_map, &mut seen);

    let mut ids: Vec<String> = seen.into_iter().collect();
    ids.sort();
    ids
}

fn walk_block(
    block_id: &str,
    root_block_id: &str,
    block_map: &Map<String, Value>,
    seen: &mut HashSet<String>,
) {
    if block_id.is_empty() || !seen.insert(block_id.to_owned()) {
        return;
    }

    let Some(block) = block_map.get(block_id) else {
        return;
    };
    let Some(block_obj) = unwrap_value(block).as_object() else {
        return;
    };

    if let Some(properties) = block_obj.get("properties") {
        for ref_id in page_references(properties) {
            walk_block(&ref_id, root_block_id, block_map, seen);
        }
    }

    if let Some(pointer_id) = block_obj
        .get("format")
        .and_then(Value::as_object)
        .and_then(|format| format.get("transclusion_reference_pointer"))
        .and_then(Value::as_object)
        .and_then(|pointer| pointer.get("id"))
        .and_then(Value::as_str)
    {
        walk_block(pointer_id, root_block_id, block_map, seen);
    }

    let content = string_array(block_obj.get("content"));
    if content.is_empty() {
        return;
    }

    let block_type = block_obj
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if block_id != root_block_id && matches!(block_type, "page" | "collection_view_page") {
        return;
    }

    for child_id in content {
        walk_block(&child_id, root_block_id, block_map, seen);
    }
}

fn page_references(value: &Value) -> Vec<String> {
    let mut refs = Vec::new();
    walk_page_references(value, &mut refs);
    refs
}

fn walk_page_references(value: &Value, refs: &mut Vec<String>) {
    match value {
        Value::Array(items) => {
            if items.len() > 1
                && items.first().and_then(Value::as_str) == Some("p")
                && items.get(1).and_then(Value::as_str).is_some()
            {
                refs.push(items[1].as_str().unwrap_or_default().to_owned());
            }
            for item in items {
                walk_page_references(item, refs);
            }
        }
        Value::Object(object) => {
            for item in object.values() {
                walk_page_references(item, refs);
            }
        }
        _ => {}
    }
}

fn signed_url_source(block: &Map<String, Value>) -> Option<String> {
    match block
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "page" => {
            let source = block
                .get("format")
                .and_then(Value::as_object)
                .and_then(|format| format.get("page_cover"))
                .and_then(Value::as_str)?;
            if needs_signed_url(source) {
                Some(source.to_owned())
            } else {
                None
            }
        }
        "pdf" | "audio" | "video" | "file" => {
            let source = property_source(block)?;
            if needs_signed_url(&source) {
                Some(source)
            } else {
                None
            }
        }
        "image" => {
            let has_file_ids = block
                .get("file_ids")
                .and_then(Value::as_array)
                .map(|items| !items.is_empty())
                .unwrap_or(false);
            if !has_file_ids {
                return None;
            }
            let source = property_source(block)?;
            if needs_signed_url(&source) {
                Some(source)
            } else {
                None
            }
        }
        _ => None,
    }
}

fn property_source(block: &Map<String, Value>) -> Option<String> {
    block
        .get("properties")
        .and_then(Value::as_object)
        .and_then(|properties| properties.get("source"))
        .and_then(first_nested_string)
}

fn first_nested_string(value: &Value) -> Option<String> {
    match value {
        Value::Array(items) => {
            for item in items {
                if let Some(text) = first_nested_string(item) {
                    return Some(text);
                }
            }
            None
        }
        Value::String(text) if !text.is_empty() => Some(text.to_owned()),
        _ => None,
    }
}

fn needs_signed_url(source: &str) -> bool {
    source.contains("secure.notion-static.com")
        || source.contains("prod-files-secure")
        || source.contains("attachment:")
}

fn ensure_object_field<'a>(
    target: &'a mut Map<String, Value>,
    key: &str,
) -> &'a mut Map<String, Value> {
    let needs_init = !matches!(target.get(key), Some(Value::Object(_)));
    if needs_init {
        target.insert(key.to_owned(), Value::Object(Map::new()));
    }
    target
        .get_mut(key)
        .and_then(Value::as_object_mut)
        .expect("object field initialized")
}

fn merge_maps(target: &mut Map<String, Value>, source: &Map<String, Value>) {
    for (key, value) in source {
        target.insert(key.clone(), value.clone());
    }
}

fn unwrap_value(mut value: &Value) -> &Value {
    while let Some(next) = value.as_object().and_then(|object| object.get("value")) {
        value = next;
    }
    value
}

fn string_array(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .filter(|item| !item.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn extract_hex_run(value: &str, width: usize) -> Option<String> {
    let chars: Vec<char> = value.chars().collect();
    let mut start = 0;
    while start < chars.len() {
        if !chars[start].is_ascii_hexdigit() {
            start += 1;
            continue;
        }

        let mut end = start;
        while end < chars.len() && chars[end].is_ascii_hexdigit() {
            end += 1;
        }
        if end - start == width {
            return Some(chars[start..end].iter().collect());
        }
        start = end + 1;
    }
    None
}

fn extract_uuid(value: &str) -> Option<String> {
    for token in value.split(|ch: char| !(ch.is_ascii_hexdigit() || ch == '-')) {
        if is_uuid(token) {
            return Some(token.to_owned());
        }
    }
    None
}

fn is_uuid(token: &str) -> bool {
    let parts: Vec<&str> = token.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let expected = [8, 4, 4, 4, 12];
    parts
        .iter()
        .zip(expected)
        .all(|(part, width)| part.len() == width && part.chars().all(|ch| ch.is_ascii_hexdigit()))
}

fn id_to_uuid(value: &str) -> String {
    if value.len() != 32 {
        return value.to_owned();
    }
    format!(
        "{}-{}-{}-{}-{}",
        &value[0..8],
        &value[8..12],
        &value[12..16],
        &value[16..20],
        &value[20..32]
    )
}
