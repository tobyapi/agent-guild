//! 生成したアイコンの枠のリポジトリ（avatar_frames 表）。絵の種類は kind（0004 の移行で足した列）:
//! 'svg' は検査して作り直した SVG を svg 列に持ち、'png' の絵はデータフォルダの frames/ にある（svg 列は空文字）。

use std::sync::Arc;

use guild_application::ports::FrameRepository;
use guild_application::AppResult;
use guild_domain::frame::{CustomFrame, FrameArt};
use rusqlite::{params, OptionalExtension, Row};

use super::codec::storage;
use super::database::Database;

const KIND_SVG: &str = "svg";
const KIND_PNG: &str = "png";
const COLUMNS: &str = "id, name, kind, svg, created_at";

pub struct SqliteFrameRepository {
    db: Arc<Database>,
}

impl SqliteFrameRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl FrameRepository for SqliteFrameRepository {
    /// 知らない種類の枠（新しい版が足したもの）は描けないので、一覧に出さない
    fn list(&self) -> AppResult<Vec<CustomFrame>> {
        self.db
            .with(|conn| {
                let sql = format!("SELECT {COLUMNS} FROM avatar_frames ORDER BY created_at, rowid");
                let rows = conn.prepare(&sql)?.query_map([], read_frame)?.collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(rows.into_iter().flatten().collect())
            })
            .map_err(storage)
    }

    fn get(&self, id: &str) -> AppResult<Option<CustomFrame>> {
        self.db
            .with(|conn| {
                let sql = format!("SELECT {COLUMNS} FROM avatar_frames WHERE id = ?1");
                conn.query_row(&sql, [id], read_frame).optional().map(Option::flatten)
            })
            .map_err(storage)
    }

    fn insert(&self, frame: &CustomFrame) -> AppResult<()> {
        let (kind, svg) = match &frame.art {
            FrameArt::Svg { svg } => (KIND_SVG, svg.as_str()),
            FrameArt::Png => (KIND_PNG, ""),
        };
        self.db
            .with(|conn| {
                conn.execute(
                    "INSERT INTO avatar_frames (id, name, kind, svg, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![frame.id, frame.name, kind, svg, frame.created_at],
                )
            })
            .map(|_| ())
            .map_err(storage)
    }

    fn delete(&self, id: &str) -> AppResult<()> {
        self.db.with(|conn| conn.execute("DELETE FROM avatar_frames WHERE id = ?1", [id])).map(|_| ()).map_err(storage)
    }
}

/// 1行を枠にする（知らない種類なら None）
fn read_frame(row: &Row<'_>) -> rusqlite::Result<Option<CustomFrame>> {
    let kind: String = row.get(2)?;
    let art = match kind.as_str() {
        KIND_SVG => FrameArt::Svg { svg: row.get(3)? },
        KIND_PNG => FrameArt::Png,
        _ => return Ok(None),
    };
    Ok(Some(CustomFrame { id: row.get(0)?, name: row.get(1)?, art, created_at: row.get(4)? }))
}
