//! 生成した枠の SVG の検査と作り直し。返事から <svg>…</svg> を取り出し、許可リスト（policy.rs）の要素と属性だけで
//! 書き直す。スクリプト・イベント属性・外への参照・foreignObject・画像・動きを見つけたら失敗にする。
//! 文字・style・title など害のない知らないものは黙って落とす。出力は自分で組み立てた文字列だけ（入力をそのまま通さない）。

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

/// 返事から最初の <svg から最後の </svg> までを取り出す（コードフェンスや前置きがあってもよい）
pub fn extract_svg(reply: &str) -> Option<&str> {
    let start = reply.find("<svg")?;
    let end = reply.rfind("</svg>")? + "</svg>".len();
    (end > start).then(|| &reply[start..end])
}

/// 検査して、許可したものだけで書き直した SVG を返す
pub fn sanitize_frame_svg(raw: &str) -> Result<String, SvgProblem> {
    if raw.len() > INPUT_MAX_BYTES {
        return Err(SvgProblem::TooLarge);
    }
    let svg = extract_svg(raw).ok_or(SvgProblem::NotFound)?;
    let mut writer = Writer::default();
    for token in tokens::tokenize(svg)? {
        writer.accept(token)?;
    }
    writer.finish()
}
