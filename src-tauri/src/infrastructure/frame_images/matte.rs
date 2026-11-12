//! 背景を透明にする。背景がすでに透明なら何もしない（スキルの絵はこれ）。透明を出せなかった絵への備えとして、背景（と
//! 中央の穴）が平らな鮮やかな一色（キーの色）なら、その色を透明にする（色の差でなめらかに抜き、縁に残ったキーの色の
//! にじみを抑える）。縁が透明でも一色でもなければ、枠と切り分けられないので断る（推測で抜かない）。

use guild_domain::frame::FrameImageProblem;

use super::raster::Rgba;

/// 縁の見本のうち、これ以上が透明なら背景は透明とみなす（割合は 10 分率）
const TRANSPARENT_BORDER_TENTHS: usize = 6;
/// 縁の見本のうち、これ以上がキーの色に近いこと（10 分率）
const UNIFORM_BORDER_TENTHS: usize = 7;
/// 縁の見本がキーの色に「近い」とみなす、チャンネルごとの差
const BORDER_TOLERANCE: u8 = 40;
/// キーの色は鮮やかであること（最大と最小のチャンネルの差）。白や灰色の背景は、枠の明るい部分まで抜けるので抜かない
const MIN_KEY_CHROMA: u8 = 96;
/// 色の差がこれ以下なら完全に透明、OPAQUE 以上なら不透明（その間はなめらかに）
const TRANSPARENT_DISTANCE: f32 = 12.0;
const OPAQUE_DISTANCE: f32 = 96.0;
/// キーの色らしさ（キーのチャンネルが他のチャンネルより強い量）がこれ以上なら、抜く候補にする
const KEY_DOMINANCE: f32 = 16.0;
/// これ以下の透明度は 0 にする（ほとんど見えないにじみ）
const ALPHA_NOISE_FLOOR: u8 = 8;
const OPAQUE_ALPHA_LIMIT: u8 = 8;

/// 背景を透明にする
pub fn remove_background(image: &mut Rgba) -> Result<(), FrameImageProblem> {
    let border = border_samples(image);
    let transparent = border.iter().filter(|sample| sample[3] <= OPAQUE_ALPHA_LIMIT).count();
    if transparent * 10 >= border.len() * TRANSPARENT_BORDER_TENTHS {
        return Ok(());
    }
    let key = median_color(&border);
    let chroma = key.iter().max().copied().unwrap_or(0) - key.iter().min().copied().unwrap_or(0);
    let close = border.iter().filter(|sample| distance([sample[0], sample[1], sample[2]], key) <= BORDER_TOLERANCE);
    if chroma < MIN_KEY_CHROMA || close.count() * 10 < border.len() * UNIFORM_BORDER_TENTHS {
        return Err(FrameImageProblem::Background);
    }
    let spill = spill_channels(key);
    for pixel in image.pixels.as_chunks_mut::<4>().0 {
        key_out(pixel, key, &spill);
    }
    Ok(())
}

/// 画像の縁（一辺の 1/128、最低 2px の帯）から、間引いて取った見本
fn border_samples(image: &Rgba) -> Vec<[u8; 4]> {
    let side = image.side;
    let band = (side / 128).max(2);
    let step = (side / 256).max(1) as usize;
    let mut samples = Vec::new();
    for along in (0..side).step_by(step) {
        for depth in 0..band {
            for (x, y) in [(along, depth), (along, side - 1 - depth), (depth, along), (side - 1 - depth, along)] {
                let at = image.index(x, y);
                samples.push([image.pixels[at], image.pixels[at + 1], image.pixels[at + 2], image.pixels[at + 3]]);
            }
        }
    }
    samples
}

fn median_color(samples: &[[u8; 4]]) -> [u8; 3] {
    let median = |channel: usize| {
        let mut values: Vec<u8> = samples.iter().map(|sample| sample[channel]).collect();
        values.sort_unstable();
        values.get(values.len() / 2).copied().unwrap_or(0)
    };
    [median(0), median(1), median(2)]
}

fn distance(a: [u8; 3], b: [u8; 3]) -> u8 {
    (0..3).map(|i| a[i].abs_diff(b[i])).max().unwrap_or(0)
}

/// キーの色を作っているチャンネル（マゼンタなら赤と青）
fn spill_channels(key: [u8; 3]) -> Vec<usize> {
    let strongest = key.iter().max().copied().unwrap_or(0);
    if strongest < 128 {
        return Vec::new();
    }
    (0..3).filter(|&i| key[i] >= strongest.saturating_sub(16) && key[i] >= 128).collect()
}

/// キーのチャンネルの強さ（複数なら弱いほう）と、ほかのチャンネルの強さ（最大）
fn strengths(rgb: [u8; 3], spill: &[usize]) -> (f32, f32) {
    let key = spill.iter().map(|&i| f32::from(rgb[i])).fold(f32::MAX, f32::min);
    let other = (0..3).filter(|i| !spill.contains(i)).map(|i| f32::from(rgb[i])).fold(0.0, f32::max);
    (key, other)
}

/// 色の差から残す割合（差が小さいほど透明。間はなめらかに）
fn distance_keep(distance: u8) -> f32 {
    let ratio =
        ((f32::from(distance) - TRANSPARENT_DISTANCE) / (OPAQUE_DISTANCE - TRANSPARENT_DISTANCE)).clamp(0.0, 1.0);
    ratio * ratio * (3.0 - 2.0 * ratio)
}

/// キーのチャンネルの強さから残す割合（キーの色が混ざった縁ほど透明）
fn dominance_keep(key_strength: f32, other: f32, key: [u8; 3]) -> f32 {
    let dominance = key_strength - other;
    if dominance <= 0.0 {
        return 1.0;
    }
    let range = (f32::from(key.iter().max().copied().unwrap_or(0)) - other).max(1.0);
    1.0 - (dominance / range).min(1.0)
}

/// 1画素のキーの色を抜く（透明度を下げ、残る縁のにじみの色を抑える）
fn key_out(pixel: &mut [u8; 4], key: [u8; 3], spill: &[usize]) {
    let rgb = [pixel[0], pixel[1], pixel[2]];
    let gap = distance(rgb, key);
    let mut keep = distance_keep(gap);
    if !spill.is_empty() {
        let (key_strength, other) = strengths(rgb, spill);
        if gap > 32 && key_strength - other < KEY_DOMINANCE {
            return;
        }
        keep = keep.min(dominance_keep(key_strength, other, key));
    }
    let alpha = (keep * f32::from(pixel[3])).round().clamp(0.0, 255.0) as u8;
    if alpha <= ALPHA_NOISE_FLOOR {
        *pixel = [0, 0, 0, 0];
        return;
    }
    pixel[3] = alpha;
    if alpha < 252 && !spill.is_empty() {
        let other = (0..3).filter(|i| !spill.contains(i)).map(|i| rgb[i]).max().unwrap_or(0);
        for &i in spill {
            pixel[i] = pixel[i].min(other.saturating_sub(1));
        }
    }
}
