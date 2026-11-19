//! 枠の SVG を使えない理由と、その文面。

/// 枠の SVG として使えない理由
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SvgProblem {
    /// 返事に <svg>…</svg> がない
    NotFound,
    TooLarge,
    /// XML として読めない・タグの対応が合わない
    Malformed,
    /// 使えない要素（script・foreignObject・image など）
    Forbidden(String),
    /// on… のイベント属性
    EventAttribute(String),
    /// 外への参照（http・data: の URL など）
    ExternalReference,
    /// 図形が1つもない
    Empty,
}
