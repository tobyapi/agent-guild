//! 枠の画像のテストに使う、合成した枠の絵と PNG の読み書き。

use std::io::Cursor;

use guild_application::ports::FrameImportError;
use guild_domain::frame::FrameImageProblem;

pub const MAGENTA: [u8; 4] = [255, 0, 255, 255];
pub const CLEAR: [u8; 4] = [0, 0, 0, 0];
pub const WOOD: [u8; 4] = [120, 72, 30, 255];
pub const GEM: [u8; 4] = [40, 90, 200, 255];

/// 合成する枠の絵（座標は 128 の中）。背景と穴は background、穴（外から inset・角の半径 corner の角丸の正方形）のまわり
/// （縁から 0〜band。外の端から 3 は空ける）は木の帯、gem なら右上の角に穴へかかる宝石、stain なら穴の真ん中に消し忘れの染み
#[derive(Clone, Copy)]
pub struct Painting {
    pub side: u32,
    pub background: [u8; 4],
    pub inset: f32,
    pub corner: f32,
    pub band: f32,
    pub gem: bool,
    pub stain: bool,
}

impl Painting {
    /// 決まった穴（20〜108・角の半径 10）どおりに描き、背景と穴をマゼンタで塗った絵
    pub fn keyed(side: u32) -> Self {
        Self { side, background: MAGENTA, inset: 20.0, corner: 10.0, band: 16.0, gem: true, stain: true }
    }

    /// 画素 (x, y) の色
    pub fn color(&self, x: u32, y: u32) -> [u8; 4] {
        let unit = 128.0 / self.side as f32;
        let (u, v) = ((x as f32 + 0.5) * unit, (y as f32 + 0.5) * unit);
        let reach = 64.0 - self.inset - self.corner;
        let (qx, qy) = ((u - 64.0).abs() - reach, (v - 64.0).abs() - reach);
        let distance = qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - self.corner;
        let inside_margin = u.min(v).min(128.0 - u.max(v)) >= 3.0;
        match () {
            () if self.gem && (u - 104.0).hypot(v - 24.0) < 12.0 => GEM,
            () if (0.0..=self.band).contains(&distance) && inside_margin => WOOD,
            () if self.stain && (u - 64.0).hypot(v - 64.0) < 6.0 => WOOD,
            () => self.background,
        }
    }

    pub fn png(&self) -> Vec<u8> {
        let mut pixels = Vec::with_capacity((self.side * self.side * 4) as usize);
        for y in 0..self.side {
            for x in 0..self.side {
                pixels.extend_from_slice(&self.color(x, y));
            }
        }
        encode(self.side, self.side, &pixels)
    }
}

pub fn encode(width: u32, height: u32, rgba: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut encoder = png::Encoder::new(&mut out, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().unwrap();
    writer.write_image_data(rgba).unwrap();
    writer.finish().unwrap();
    out
}

/// 保存された PNG（RGBA 8bit であること）
pub struct Decoded {
    pub side: u32,
    buffer: Vec<u8>,
}

impl Decoded {
    pub fn new(bytes: &[u8]) -> Self {
        let decoder = png::Decoder::new(Cursor::new(bytes.to_vec()));
        let mut reader = decoder.read_info().unwrap();
        let mut buffer = vec![0; reader.output_buffer_size().unwrap()];
        let info = reader.next_frame(&mut buffer).unwrap();
        assert_eq!((info.color_type, info.bit_depth), (png::ColorType::Rgba, png::BitDepth::Eight));
        assert_eq!(info.width, info.height);
        Self { side: info.width, buffer }
    }

    /// 画素 (x, y)
    pub fn at(&self, x: u32, y: u32) -> [u8; 4] {
        let at = (y as usize * self.side as usize + x as usize) * 4;
        [self.buffer[at], self.buffer[at + 1], self.buffer[at + 2], self.buffer[at + 3]]
    }

    /// 128 の座標の画素
    pub fn pixel(&self, u: f32, v: f32) -> [u8; 4] {
        let scale = self.side as f32 / 128.0;
        self.at((u * scale) as u32, (v * scale) as u32)
    }
}

pub fn problem(result: Result<Vec<u8>, FrameImportError>) -> FrameImageProblem {
    match result {
        Err(FrameImportError::Unusable(problem)) => problem,
        other => panic!("使えない画像として断られるはず: {:?}", other.map(|bytes| bytes.len())),
    }
}
