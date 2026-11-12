//! 枠の形の加工: 中央の穴（内蔵の枠と同じ、128 の中の 20〜108 の角丸の正方形）のまわりの帯の確かめと、穴の中ほどの
//! くり抜き、大きさの変更。スキルの枠は、内蔵の枠と同じく角の飾りが穴の角に重なることがあり（主装飾は角に置く）、穴の角も
//! 決まった穴（角の半径 10）より丸い（半径 17〜29 ほど）。穴いっぱいをくり抜くと、角の飾りや細い帯（64px で 2〜4px）を
//! 削ってしまうので、くり抜くのは顔の来る中ほどだけにする。

use std::f32::consts::PI;

use guild_domain::frame::{FrameImageProblem, FRAME_OPENING_INSET, FRAME_VIEWBOX};

use super::raster::Rgba;

/// くり抜く範囲: 顔の来る中ほど（中心から 128 の中の半径 CLEAR_RADIUS の円。穴の半分の幅は 44）
const CLEAR_RADIUS: f32 = 32.0;
/// 帯を探す範囲: 穴の縁（角はスキルの穴に合わせて半径 RING_RADIUS に丸める）から外へ 128 の中の BAND_UNITS まで。
/// そこに、穴のまわりの向きの7割以上で見える画素があること（細い帯でも穴を囲んでいれば足りるよう、面積ではなく向きで数える）
const RING_RADIUS: f32 = 28.0;
const BAND_UNITS: f32 = 12.0;
const DIRECTIONS: usize = 64;
const COVERED_DIRECTIONS_TENTHS: usize = 7;
const VISIBLE_ALPHA: u8 = 128;

/// 画素の中心から中心までの距離（px）
fn center_offset(side: u32, x: u32, y: u32) -> (f32, f32) {
    let half = side as f32 / 2.0;
    (x as f32 + 0.5 - half, y as f32 + 0.5 - half)
}

/// 画素の中心から、角を RING_RADIUS に丸めた穴の縁までの距離（px。穴の外が正、中が負）
fn ring_distance(side: u32, x: u32, y: u32) -> f32 {
    let scale = side as f32 / FRAME_VIEWBOX as f32;
    let radius = RING_RADIUS * scale;
    let reach = (FRAME_VIEWBOX as f32 / 2.0 - FRAME_OPENING_INSET as f32) * scale - radius;
    let (dx, dy) = center_offset(side, x, y);
    let (qx, qy) = (dx.abs() - reach, dy.abs() - reach);
    qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - radius
}

/// 穴の中ほどをくり抜く（中は完全に透明。縁の1画素はなめらかに）。アバターの顔が枠の絵で隠れないようにする
pub fn punch_opening(image: &mut Rgba) {
    let radius = CLEAR_RADIUS * image.side as f32 / FRAME_VIEWBOX as f32;
    for y in 0..image.side {
        for x in 0..image.side {
            let (dx, dy) = center_offset(image.side, x, y);
            let keep = (dx.hypot(dy) - radius + 0.5).clamp(0.0, 1.0);
            if keep >= 1.0 {
                continue;
            }
            let at = image.index(x, y);
            let alpha = (f32::from(image.pixels[at + 3]) * keep).round() as u8;
            if alpha == 0 {
                image.pixels[at..at + 4].copy_from_slice(&[0, 0, 0, 0]);
            } else {
                image.pixels[at + 3] = alpha;
            }
        }
    }
}

/// 背景を除いたあと、穴のまわりに枠の帯が残っているか
pub fn check_band(image: &Rgba) -> Result<(), FrameImageProblem> {
    let band = BAND_UNITS * image.side as f32 / FRAME_VIEWBOX as f32;
    let (mut seen, mut covered) = ([false; DIRECTIONS], [false; DIRECTIONS]);
    for y in 0..image.side {
        for x in 0..image.side {
            let distance = ring_distance(image.side, x, y);
            if distance <= 0.0 || distance > band {
                continue;
            }
            let (dx, dy) = center_offset(image.side, x, y);
            let turn = (dy.atan2(dx) + PI) / (2.0 * PI);
            let direction = ((turn * DIRECTIONS as f32) as usize).min(DIRECTIONS - 1);
            seen[direction] = true;
            covered[direction] |= image.alpha(x, y) >= VISIBLE_ALPHA;
        }
    }
    let seen = seen.iter().filter(|&&seen| seen).count();
    let covered = covered.iter().filter(|&&covered| covered).count();
    if seen > 0 && covered * 10 >= seen * COVERED_DIRECTIONS_TENTHS {
        Ok(())
    } else {
        Err(FrameImageProblem::NoFrame)
    }
}

/// 面積の平均で side の正方形に縮める（色は透明度を掛けた値で平均し、透明な背景の色が縁ににじまないようにする）
pub fn resize(image: &Rgba, side: u32) -> Rgba {
    if image.side == side {
        return image.clone();
    }
    let premultiplied: Vec<[f32; 4]> = image
        .pixels
        .as_chunks::<4>()
        .0
        .iter()
        .map(|p| {
            let a = f32::from(p[3]) / 255.0;
            [f32::from(p[0]) * a, f32::from(p[1]) * a, f32::from(p[2]) * a, f32::from(p[3])]
        })
        .collect();
    let weights = axis_weights(image.side, side);
    let source = image.side as usize;
    let mut rows = vec![[0.0f32; 4]; source * side as usize];
    for y in 0..source {
        for (x, taps) in weights.iter().enumerate() {
            rows[y * side as usize + x] = blend(taps, |i| premultiplied[y * source + i]);
        }
    }
    let mut out = Rgba::new(side);
    for (y, taps) in weights.iter().enumerate() {
        for x in 0..side as usize {
            let [r, g, b, a] = blend(taps, |i| rows[i * side as usize + x]);
            let at = (y * side as usize + x) * 4;
            out.pixels[at..at + 4].copy_from_slice(&straight([r, g, b, a]));
        }
    }
    out
}

/// 縮めた先の1画素が、元のどの画素からどれだけの割合を取るか
fn axis_weights(from: u32, to: u32) -> Vec<Vec<(usize, f32)>> {
    let ratio = from as f32 / to as f32;
    (0..to)
        .map(|i| {
            let (start, end) = (i as f32 * ratio, (i + 1) as f32 * ratio);
            let mut taps = Vec::new();
            for source in start.floor() as usize..(end.ceil() as usize).min(from as usize) {
                let overlap = (end.min(source as f32 + 1.0) - start.max(source as f32)).max(0.0);
                if overlap > 0.0 {
                    taps.push((source, overlap / ratio));
                }
            }
            taps
        })
        .collect()
}

fn blend(taps: &[(usize, f32)], pixel: impl Fn(usize) -> [f32; 4]) -> [f32; 4] {
    let mut sum = [0.0f32; 4];
    for &(index, weight) in taps {
        let value = pixel(index);
        for channel in 0..4 {
            sum[channel] += value[channel] * weight;
        }
    }
    sum
}

/// 透明度を掛けた色を、ふつうの RGBA 8bit に戻す
fn straight([r, g, b, a]: [f32; 4]) -> [u8; 4] {
    let alpha = a.round().clamp(0.0, 255.0);
    if alpha < 1.0 {
        return [0, 0, 0, 0];
    }
    let unit = alpha / 255.0;
    let channel = |value: f32| (value / unit).round().clamp(0.0, 255.0) as u8;
    [channel(r), channel(g), channel(b), alpha as u8]
}
