//! 描かれた穴を、決まった穴（128 の中の 20〜108）に合わせる。スキルの穴は画面の約70〜80％（64px なら 45〜51px）で、
//! 決まった穴（68.75％）より大きいことが多く、そのままでは枠の帯とアバターのあいだに隙間ができる。背景を抜いたあとの絵で、
//! 中央から上下左右へ最初に見える画素（帯の内側の縁）を測り、その穴が決まった穴に重なるよう、絵全体を同じ倍率で
//! 縮めて（まわりに透明な余白を足して）中心をそろえる。画素は写すだけで描き直さない（縦横比も細かさも変えない。64px の
//! 絵は 64px 前後のまま）。穴が小さければ、外の透明な余白の分だけ広げる（見える画素は切らない。広げられなければ、
//! くり抜きで帯の内側が少し削れる）。中心は縮めて空いた余白の分しかずらさない。測れないときはそのまま。

use guild_domain::frame::{FRAME_OPENING_INSET, FRAME_VIEWBOX};

use super::raster::Rgba;

/// 帯の内側の縁とみなす透明度
const VISIBLE_ALPHA: u8 = 128;
/// 縮める倍率の下限と、広げる倍率の上限
const MIN_SCALE: f32 = 0.75;
const MAX_SCALE: f32 = 1.2;
/// 広げるときに切ってはいけない画素の透明度（これより薄いにじみは切れてよい）
const CONTENT_ALPHA: u8 = 16;
/// 中心をずらしてよい範囲の上限（一辺に対する割合。縮めて空いた余白の分までに限る）
const MAX_SHIFT: f32 = 0.04;
/// 測った穴の半分の幅が、一辺のこの範囲になければ測り違いとみなす
const MIN_HALF: f32 = 0.22;
const MAX_HALF: f32 = 0.47;

/// 描かれた穴の中心と、半分の幅（px）
struct Opening {
    cx: f32,
    cy: f32,
    half: f32,
}

/// 穴を合わせた絵（一辺は倍率に応じて変わる。上限より大きければ、あとで縮める）
pub fn fit_opening(image: &Rgba) -> Rgba {
    let Some(opening) = measure(image) else {
        return image.clone();
    };
    let side = image.side as f32;
    let target = (FRAME_VIEWBOX as f32 / 2.0 - FRAME_OPENING_INSET as f32) / FRAME_VIEWBOX as f32 * side;
    let room = side / content_span(image).max(1.0);
    let scale = (target / opening.half).clamp(MIN_SCALE, MAX_SCALE.min(room).max(1.0));
    let window = (side / scale).round().max(1.0) as u32;
    let shift = (side * MAX_SHIFT).min((window as f32 - side) / 2.0).max(0.0);
    let center = |value: f32| value.clamp(side / 2.0 - shift, side / 2.0 + shift);
    let left = (center(opening.cx) - window as f32 / 2.0).round() as i64;
    let top = (center(opening.cy) - window as f32 / 2.0).round() as i64;
    let mut out = Rgba::new(window);
    for y in 0..window {
        let source_y = top + i64::from(y);
        if !(0..i64::from(image.side)).contains(&source_y) {
            continue;
        }
        for x in 0..window {
            let source_x = left + i64::from(x);
            if (0..i64::from(image.side)).contains(&source_x) {
                let from = image.index(source_x as u32, source_y as u32);
                let to = out.index(x, y);
                out.pixels[to..to + 4].copy_from_slice(&image.pixels[from..from + 4]);
            }
        }
    }
    out
}

/// 中心からいちばん遠い見える画素までを収める窓の一辺（広げるときは、窓を画像の中心に置いてこれより小さくしない。
/// 窓の端を画素にそろえるときの丸めの分、1px 足す）
fn content_span(image: &Rgba) -> f32 {
    let half = image.side as f32 / 2.0;
    let mut reach = 0.0f32;
    for y in 0..image.side {
        for x in 0..image.side {
            if image.alpha(x, y) >= CONTENT_ALPHA {
                let far = |at: u32| (at as f32 - half).abs().max((at as f32 + 1.0 - half).abs());
                reach = reach.max(far(x)).max(far(y));
            }
        }
    }
    reach * 2.0 + 1.0
}

/// 中央の帯（一辺の 1/5）の行と列で、中心から外へ最初に見える画素までの距離を測り、その中央値で穴を決める
fn measure(image: &Rgba) -> Option<Opening> {
    let side = image.side;
    let center = side / 2;
    let spread = side / 10;
    let step = (side / 128).max(1) as usize;
    let (mut left, mut right, mut top, mut bottom) = (Vec::new(), Vec::new(), Vec::new(), Vec::new());
    for line in (center - spread..=center + spread).step_by(step) {
        left.extend(reach(center, |i| image.alpha(center - i, line)));
        right.extend(reach(side - center, |i| image.alpha(center + i, line)));
        top.extend(reach(center, |i| image.alpha(line, center - i)));
        bottom.extend(reach(side - center, |i| image.alpha(line, center + i)));
    }
    let lines = (2 * spread) as usize / step + 1;
    let [left, right, top, bottom] = [left, right, top, bottom].map(|found| median(found, lines));
    // 穴の縁は、見えた画素の内側の辺（左と上は、見えた画素の次の画素から穴）
    let (left, right) = (center as f32 - left? + 1.0, center as f32 + right?);
    let (top, bottom) = (center as f32 - top? + 1.0, center as f32 + bottom?);
    let half = (right - left + bottom - top) / 4.0;
    let ratio = half / side as f32;
    (MIN_HALF..=MAX_HALF).contains(&ratio).then_some(Opening {
        cx: (left + right) / 2.0,
        cy: (top + bottom) / 2.0,
        half,
    })
}

/// 中心から i 画素先が見えるまでの距離（limit までに見えなければ None）
fn reach(limit: u32, alpha: impl Fn(u32) -> u8) -> Option<f32> {
    (0..limit).find(|&i| alpha(i) >= VISIBLE_ALPHA).map(|i| i as f32)
}

/// 半分以上の行・列で測れたときだけ、その中央値
fn median(mut found: Vec<f32>, lines: usize) -> Option<f32> {
    if found.len() * 2 < lines {
        return None;
    }
    found.sort_by(f32::total_cmp);
    found.get(found.len() / 2).copied()
}
