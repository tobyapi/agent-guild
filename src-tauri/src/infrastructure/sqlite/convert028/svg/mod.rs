//! Revalidate stored v0.1.28 frame artwork before copying its original bytes.
mod allowlist;
mod policy;
mod problem;
mod tokens;
mod writer;

pub use problem::SvgProblem;
use writer::Writer;

/// 保存する SVG の最大バイト数（作り直した後）
pub const FRAME_SVG_MAX_BYTES: usize = 32 * 1024;
/// 受け取る返事の最大バイト数（作り直す前）
const INPUT_MAX_BYTES: usize = 4 * FRAME_SVG_MAX_BYTES;
const MAX_ELEMENTS: usize = 2000;
const MAX_DEPTH: usize = 32;
const MAX_VALUE_CHARS: usize = 20_000;
const SVG_NAMESPACE: &str = "http://www.w3.org/2000/svg";
const DEFAULT_VIEWBOX: &str = "0 0 128 128";

/// 検査して、許可したものだけで書き直した SVG を返す
pub fn sanitize_frame_svg(raw: &str) -> Result<String, SvgProblem> {
    if raw.len() > INPUT_MAX_BYTES {
        return Err(SvgProblem::TooLarge);
    }
    let svg = raw.trim();
    if !svg.starts_with("<svg") || !svg.ends_with("</svg>") {
        return Err(SvgProblem::NotFound);
    }
    let mut writer = Writer::default();
    for token in tokens::tokenize(svg)? {
        writer.accept(token)?;
    }
    writer.finish()
}
