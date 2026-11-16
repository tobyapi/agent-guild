//! Result of reading an image referenced in a message.
use serde::Serialize;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum LocalImage {
    Ok { mime: &'static str, base64: String },
    NotFound,
    Unsupported,
}
