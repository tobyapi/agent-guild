//! 生成した枠の画像（PNG）の決まりごと: 穴の位置（内蔵の枠と同じ割合）・受け取る大きさ・保存する大きさと、使えない理由の文面。
//! 画像を読む・加工する処理は本体クレートの infrastructure（frame_images）にある。

use crate::locale;

/// 枠の座標の大きさ（内蔵の枠と同じ viewBox="0 0 128 128"。画像はこれを拡大縮小した割合で扱う）
pub const FRAME_VIEWBOX: u32 = 128;
/// アバターが入る角丸の正方形の穴の、外からの距離（穴は 20〜108。一辺 88。画面はこの穴にアバターを合わせる）
pub const FRAME_OPENING_INSET: u32 = 20;
/// 穴の角の半径
pub const FRAME_OPENING_RADIUS: u32 = 10;
/// 保存する画像の一辺の上限（px）。これより大きい画像は縮め、小さい画像は拡大せずそのままの細かさで保存する
/// （スキルの既定の納品サイズは 64px。アバターは最大 64px・枠の箱は最大 93px ほどで描くので、高精細の画面でも足りる）
pub const FRAME_IMAGE_MAX_SIDE: u32 = 512;
/// 受け取る画像の一辺の範囲（px）。正方形であること
pub const FRAME_SOURCE_MIN_SIDE: u32 = 32;
pub const FRAME_SOURCE_MAX_SIDE: u32 = 2048;
/// 受け取る画像のファイルの大きさの上限
pub const FRAME_SOURCE_MAX_BYTES: u64 = 8 * 1024 * 1024;

/// 生成した画像を枠として使えない理由
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrameImageProblem {
    /// 画像のファイルがない（生成が画像を残さなかった）
    Missing,
    /// ファイルが大きすぎる
    TooLarge,
    /// PNG として読めない
    NotPng,
    /// 正方形でない・小さすぎる・大きすぎる
    BadSize,
    /// 背景が透明でも平らな鮮やかな一色でもなく、枠と切り分けられない
    Background,
    /// 背景を除くと、枠の帯がほとんど残らない
    NoFrame,
}

impl FrameImageProblem {
    /// 使用者に見せる文面（いまの言語）
    pub fn message(self) -> &'static str {
        match self {
            Self::Missing => locale::pick([
                "画像が見つかりませんでした",
                "No image was found",
                "没有找到图像",
                "沒有找到圖像",
                "이미지를 찾을 수 없습니다",
            ]),
            Self::TooLarge => locale::pick([
                "画像のファイルが大きすぎます",
                "The image file is too large",
                "图像文件过大",
                "圖像檔案過大",
                "이미지 파일이 너무 큽니다",
            ]),
            Self::NotPng => locale::pick([
                "PNG の画像として読めませんでした",
                "The image could not be read as a PNG",
                "无法作为 PNG 图像读取",
                "無法作為 PNG 圖像讀取",
                "PNG 이미지로 읽을 수 없습니다",
            ]),
            Self::BadSize => locale::pick([
                "画像が正方形でないか、大きさが合いません",
                "The image is not square or has an unsupported size",
                "图像不是正方形，或尺寸不受支持",
                "圖像不是正方形，或尺寸不受支援",
                "이미지가 정사각형이 아니거나 크기가 맞지 않습니다",
            ]),
            Self::Background => locale::pick([
                "背景が透明でも一色でもなく、枠と切り分けられませんでした",
                "The background was neither transparent nor one flat color, so it couldn't be separated from the frame",
                "背景既不透明也不是单一颜色，无法与头像框分离",
                "背景既不透明也不是單一顏色，無法與頭像框分離",
                "배경이 투명하지도 단색이지도 않아 테두리와 분리할 수 없었습니다",
            ]),
            Self::NoFrame => locale::pick([
                "背景を除くと、枠がほとんど残りませんでした",
                "Almost no frame was left after removing the background",
                "去除背景后几乎没有留下头像框",
                "去除背景後幾乎沒有留下頭像框",
                "배경을 제거하자 테두리가 거의 남지 않았습니다",
            ]),
        }
    }
}
