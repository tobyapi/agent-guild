//! 発言に添える画像とファイル（添付）。中身はデータフォルダの attachments/<チャンネル>/<id>.<拡張子> に置き、
//! 発言にはメタデータだけを持つ。添付できるのは人間の発言だけ。
//! 画像（PNG・JPEG・GIF・WebP）はエージェントに画像として渡し、ほかのファイルはパスを伝えて読んでもらう。

use serde::{Deserialize, Serialize};

use super::error::ValidationError;
use super::ids::AttachmentId;
use super::locale;

/// 1つの発言に添えられる数（画像とファイルの合計）
pub const MAX_ATTACHMENTS: usize = 10;
/// 画像1枚の大きさの上限（バイト）。Claude の画像入力の上限に合わせる
pub const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
/// 画像以外のファイル1つの大きさの上限（バイト）
pub const MAX_FILE_BYTES: usize = 10 * 1024 * 1024;
/// 1つの発言の添付の合計の上限（バイト）。送信は base64 の JSON で届くので大きくしすぎない
pub const MAX_TOTAL_BYTES: usize = 30 * 1024 * 1024;
/// 表示用の名前の最大文字数と、保存するファイル名に使う拡張子の最大文字数
const MAX_NAME_CHARS: usize = 100;
const MAX_EXTENSION_CHARS: usize = 10;
/// 画像として渡す形式と、保存するときの拡張子
const IMAGE_TYPES: [(&str, &str); 4] =
    [("image/png", "png"), ("image/jpeg", "jpg"), ("image/gif", "gif"), ("image/webp", "webp")];

/// 添付（TS の Attachment）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: AttachmentId,
    /// 表示用の名前（元のファイル名。貼り付けた画像は「image.png」など）
    pub name: String,
    pub media_type: String,
    /// バイト数
    pub size: u64,
}

impl Attachment {
    /// エージェントに画像として渡すか
    pub fn is_image(&self) -> bool {
        is_image(&self.media_type)
    }

    /// 保存するファイル名（id + 拡張子。画像は形式から、ほかは名前から）
    pub fn file_name(&self) -> String {
        format!("{}.{}", self.id.as_str(), extension(&self.name, &self.media_type))
    }
}

/// 送信で受け取る添付（TS の AttachmentInput）。data は中身の base64（デコードは interface 層が行う）
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentInput {
    pub name: String,
    pub media_type: String,
    pub data: String,
}

/// 保存前の添付（中身つき）
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewAttachment {
    pub name: String,
    pub media_type: String,
    pub bytes: Vec<u8>,
}

impl NewAttachment {
    /// id を振ったメタデータ（名前は表示用に整える）
    pub fn describe(&self, id: AttachmentId) -> Attachment {
        Attachment {
            id,
            name: display_name(&self.name, &self.media_type),
            media_type: self.media_type.clone(),
            size: u64::try_from(self.bytes.len()).unwrap_or(u64::MAX),
        }
    }
}

/// 画像として渡す形式か
pub fn is_image(media_type: &str) -> bool {
    IMAGE_TYPES.iter().any(|(kind, _)| *kind == media_type)
}

/// 数・種類・大きさを検証する（違反は field `attachments`）
pub fn validate_attachments(items: &[NewAttachment]) -> Result<(), ValidationError> {
    if items.len() > MAX_ATTACHMENTS {
        return Err(invalid(locale::pick([
            format!("添付は1回に{MAX_ATTACHMENTS}個までです"),
            format!("You can attach up to {MAX_ATTACHMENTS} files at a time"),
            format!("每次最多可添加 {MAX_ATTACHMENTS} 个附件"),
            format!("每次最多可附加 {MAX_ATTACHMENTS} 個附件"),
            format!("첨부 파일은 한 번에 {MAX_ATTACHMENTS}개까지입니다"),
        ])));
    }
    items.iter().try_for_each(validate_one)?;
    if items.iter().map(|item| item.bytes.len()).sum::<usize>() > MAX_TOTAL_BYTES {
        return Err(invalid(locale::pick([
            "添付の合計は 30MB までです",
            "Attachments can total up to 30 MB",
            "附件总大小不能超过 30MB",
            "附件總大小不能超過 30MB",
            "첨부 파일은 합계 30MB까지입니다",
        ])));
    }
    Ok(())
}

fn validate_one(item: &NewAttachment) -> Result<(), ValidationError> {
    if !is_media_type(&item.media_type) {
        return Err(invalid(locale::pick([
            "ファイルの種類が正しくありません",
            "The file type is invalid",
            "文件类型不正确",
            "檔案類型不正確",
            "파일 형식이 올바르지 않습니다",
        ])));
    }
    if item.bytes.is_empty() {
        return Err(invalid(locale::pick([
            "空のファイルは添付できません",
            "Empty files cannot be attached",
            "不能添加空文件",
            "無法附加空白檔案",
            "빈 파일은 첨부할 수 없습니다",
        ])));
    }
    let (limit, message) = if is_image(&item.media_type) {
        (
            MAX_IMAGE_BYTES,
            [
                "画像は1枚 5MB までです",
                "Each image can be up to 5 MB",
                "每张图片最大 5MB",
                "每張圖片最大 5MB",
                "이미지는 한 장에 5MB까지입니다",
            ],
        )
    } else {
        (
            MAX_FILE_BYTES,
            [
                "ファイルは1つ 10MB までです",
                "Each file can be up to 10 MB",
                "每个文件最大 10MB",
                "每個檔案最大 10MB",
                "파일은 하나에 10MB까지입니다",
            ],
        )
    };
    if item.bytes.len() > limit {
        return Err(invalid(locale::pick(message)));
    }
    Ok(())
}

fn invalid(message: impl Into<String>) -> ValidationError {
    ValidationError::on("attachments", message)
}

/// MIME の形（type/subtype。RFC 6838 の名前に使える文字だけ）か
fn is_media_type(value: &str) -> bool {
    let token =
        |part: &str| !part.is_empty() && part.chars().all(|c| c.is_ascii_alphanumeric() || "!#$&^_.+-".contains(c));
    value.len() <= 100 && value.split_once('/').is_some_and(|(kind, subtype)| token(kind) && token(subtype))
}

/// 保存するときの拡張子: 画像は形式から、ほかは名前の拡張子（英数字。なければ bin）
fn extension(name: &str, media_type: &str) -> String {
    match IMAGE_TYPES.iter().find(|(kind, _)| *kind == media_type) {
        Some((_, ext)) => (*ext).to_owned(),
        None => name_extension(name).unwrap_or_else(|| "bin".to_owned()),
    }
}

fn name_extension(name: &str) -> Option<String> {
    let (_, ext) = name.rsplit_once('.')?;
    let valid =
        !ext.is_empty() && ext.chars().count() <= MAX_EXTENSION_CHARS && ext.chars().all(|c| c.is_ascii_alphanumeric());
    valid.then(|| ext.to_ascii_lowercase())
}

/// 表示用の名前: パスの区切りより後ろだけを使い、空なら「image.png」「file.bin」など、長ければ拡張子を残して前を切る
fn display_name(name: &str, media_type: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or_default().trim();
    if base.is_empty() {
        let stem = if is_image(media_type) { "image" } else { "file" };
        return format!("{stem}.{}", extension("", media_type));
    }
    if base.chars().count() <= MAX_NAME_CHARS {
        return base.to_owned();
    }
    match name_extension(base) {
        Some(ext) => {
            let stem: String = base.chars().take(MAX_NAME_CHARS - ext.chars().count() - 1).collect();
            format!("{stem}.{ext}")
        }
        None => base.chars().take(MAX_NAME_CHARS).collect(),
    }
}
