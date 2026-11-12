//! 取り込むときの加工: 背景（キーの色・透明）を抜き、描かれた穴を決まった穴（20〜108）に合わせ、上限より大きければ縮め、
//! 顔の来る穴の中ほどだけをくり抜くこと。スキルの既定の 64px の絵は、描き直さずにそのままの画素で保存すること。

use guild_domain::frame::FRAME_IMAGE_MAX_SIDE;

use super::painting::{Decoded, Painting, CLEAR, GEM, WOOD};
use crate::infrastructure::frame_images::prepare;

#[test]
fn a_keyed_background_becomes_transparent_and_large_images_are_shrunk() {
    let stored = Decoded::new(&prepare(&Painting::keyed(1024).png()).unwrap());
    assert_eq!(stored.side, FRAME_IMAGE_MAX_SIDE);
    for (u, v) in [(1.0, 1.0), (126.0, 64.0), (64.0, 126.5), (21.0, 64.0), (64.0, 107.0)] {
        assert_eq!(stored.pixel(u, v)[3], 0, "背景と穴 ({u}, {v})");
    }
    assert_eq!(stored.pixel(64.0, 64.0), CLEAR, "穴の中ほどの染みはくり抜く");
    assert_eq!(stored.pixel(12.0, 64.0), WOOD, "枠の帯は残る");
    assert_eq!(stored.pixel(110.0, 14.0), GEM, "穴の外の飾りは残る");
    assert_eq!(stored.pixel(100.0, 28.0), GEM, "穴の角にかかった飾りも残す（内蔵の枠と同じ）");
}

#[test]
fn a_larger_drawn_opening_is_shrunk_so_the_band_meets_the_avatar() {
    // 穴を 16〜112 に大きく描いた（帯は 3〜16）。合わせないと、帯とアバター（20〜108）のあいだに隙間ができる
    let drawn = Painting { inset: 16.0, stain: false, ..Painting::keyed(1024) };
    let stored = Decoded::new(&prepare(&drawn.png()).unwrap());
    for (u, v) in [(19.0, 64.0), (64.0, 19.0), (109.0, 64.0), (64.0, 109.0)] {
        assert_eq!(stored.pixel(u, v), WOOD, "穴のすぐ外は帯 ({u}, {v})");
    }
    assert_eq!(stored.pixel(21.0, 64.0), CLEAR);
    assert_eq!(stored.pixel(1.0, 64.0)[3], 0, "縮めた分の外側は透明");
}

#[test]
fn a_smaller_drawn_opening_is_enlarged_only_within_the_transparent_margin() {
    // 穴を 24〜104 に小さく描いた（帯は 8〜24、外は透明）。外の余白の分だけ広げ、帯の内側の縁を穴の縁に合わせる
    let drawn = Painting { background: CLEAR, inset: 24.0, stain: false, ..Painting::keyed(512) };
    let stored = Decoded::new(&prepare(&drawn.png()).unwrap());
    assert!(stored.side < 512, "広げても画素は描き直さない（切り出すだけ）: {}", stored.side);
    for (u, v) in [(19.0, 64.0), (64.0, 19.0), (109.0, 64.0), (64.0, 109.0)] {
        assert_eq!(stored.pixel(u, v), WOOD, "穴のすぐ外は帯 ({u}, {v})");
    }
    assert_eq!(stored.pixel(21.5, 64.0), CLEAR);
    // 見える画素は切らない（右上の宝石の端まで残る）
    let gems = (0..stored.side).flat_map(|y| (0..stored.side).map(move |x| (x, y)));
    let count = gems.filter(|&(x, y)| stored.at(x, y) == GEM).count();
    let drawn_gems = (0..512).flat_map(|y| (0..512).map(move |x| (x, y)));
    assert_eq!(count, drawn_gems.filter(|&(x, y)| drawn.color(x, y) == GEM).count());
}

#[test]
fn a_small_skill_frame_keeps_its_own_pixels_and_thin_core() {
    // スキルの既定: 64px・本当に透明な背景・穴は 75%（48px）で角が丸い（半径 20）・帯は細い（3px）・角に飾り
    let drawn = Painting { side: 64, background: CLEAR, inset: 16.0, corner: 20.0, band: 6.0, gem: true, stain: true };
    let stored = Decoded::new(&prepare(&drawn.png()).unwrap());
    // 穴（48px）を決まった穴（68.75%）に合わせるため、まわりに透明な余白を足すだけ（64 / (44 / 48) ≒ 70px。拡大しない）
    assert_eq!(stored.side, 70);
    let offset = 3;
    let clear_radius = 32.0 * 70.0 / 128.0 + 1.0;
    for y in 0..64 {
        for x in 0..64 {
            let (dx, dy) = (x as f32 + 0.5 - 32.0, y as f32 + 0.5 - 32.0);
            if dx.hypot(dy) > clear_radius {
                assert_eq!(stored.at(x + offset, y + offset), drawn.color(x, y), "({x}, {y}) は描かれたまま");
            }
        }
    }
    assert_eq!(stored.at(35, 35), CLEAR, "穴の中ほどの染みはくり抜く");
    assert_eq!(stored.at(offset + 7, 35), WOOD, "細い帯の内側の縁も削らない");
}
