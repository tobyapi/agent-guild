//! 枠の SVG を使えない理由と、その文面。

use crate::locale;

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

impl SvgProblem {
    /// 使用者に見せる文面（いまの言語）
    pub fn message(&self) -> String {
        match self {
            Self::NotFound => locale::pick([
                "返事に SVG が見つかりませんでした",
                "No SVG was found in the reply",
                "回复中没有找到 SVG",
                "回覆中沒有找到 SVG",
                "응답에서 SVG를 찾을 수 없습니다",
            ])
            .to_owned(),
            Self::TooLarge => locale::pick([
                "SVG が大きすぎます",
                "The SVG is too large",
                "SVG 过大",
                "SVG 過大",
                "SVG가 너무 큽니다",
            ])
            .to_owned(),
            Self::Malformed => locale::pick([
                "SVG として読めませんでした",
                "The SVG could not be read",
                "无法读取该 SVG",
                "無法讀取該 SVG",
                "SVG를 읽을 수 없습니다",
            ])
            .to_owned(),
            Self::Forbidden(name) | Self::EventAttribute(name) => locale::pick([
                format!("使えない要素や属性（{name}）が含まれていました"),
                format!("The SVG contained a disallowed element or attribute ({name})"),
                format!("包含不允许的元素或属性（{name}）"),
                format!("包含不允許的元素或屬性（{name}）"),
                format!("허용되지 않는 요소나 속성({name})이 포함되어 있습니다"),
            ]),
            Self::ExternalReference => locale::pick([
                "外部への参照が含まれていました",
                "The SVG referred to something outside itself",
                "包含对外部的引用",
                "包含對外部的引用",
                "외부 참조가 포함되어 있습니다",
            ])
            .to_owned(),
            Self::Empty => locale::pick([
                "枠の図形が描かれていませんでした",
                "The SVG did not draw any shapes",
                "SVG 中没有绘制任何图形",
                "SVG 中沒有繪製任何圖形",
                "SVG에 그려진 도형이 없습니다",
            ])
            .to_owned(),
        }
    }
}
