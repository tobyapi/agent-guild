//! チャンネルのアイコン（絵文字1つ。空なら画面は # を出す）の規則。
//! TS 側（src/shared/lib/channelIcon.ts）と同じ。正はこちらで、実例は contracts/behavior/channel-icons.json。

use crate::error::ValidationError;
use crate::locale;

/// アイコンの最大バイト数（UTF-8）。家族の ZWJ 合成や旗のタグ列も収まる長さ
pub const CHANNEL_ICON_MAX_BYTES: usize = 32;

const ZERO_WIDTH_JOINER: char = '\u{200D}';

/// アイコンを正規化する。前後の空白を除き、空と「#」（全角の ＃ も）は空（# を出す）にする。
/// それ以外は絵文字1つ分（書記素のおおよそ1つ）で、空白・制御文字・ASCII の英字を含まず、ASCII だけでもないこと
pub fn normalize_channel_icon(icon: &str) -> Result<String, ValidationError> {
    let icon = icon.trim();
    if icon.is_empty() || icon == "#" || icon == "＃" {
        return Ok(String::new());
    }
    if is_single_symbol(icon) {
        Ok(icon.to_owned())
    } else {
        Err(ValidationError::on(
            "icon",
            locale::pick([
                "アイコンは絵文字1つにしてください",
                "Use a single emoji for the icon",
                "图标请使用一个表情符号",
                "圖示請使用一個表情符號",
                "아이콘은 이모지 하나로 지정하십시오",
            ]),
        ))
    }
}

fn is_single_symbol(icon: &str) -> bool {
    icon.len() <= CHANNEL_ICON_MAX_BYTES
        && !icon.is_ascii()
        && !icon.chars().any(|c| c.is_whitespace() || c.is_control() || c.is_ascii_alphabetic())
        && base_count(icon) == Some(1)
}

/// 基底の文字の数。結合する文字（異体字セレクタ・肌の色・キーキャップ・タグ・結合記号）と、
/// ZWJ の直後の文字は前の文字に数え、地域指示子は2つで1つ（旗）。ZWJ で終わるなら None
fn base_count(icon: &str) -> Option<usize> {
    let mut count = 0;
    let mut after_joiner = false;
    let mut open_flag = false;
    for c in icon.chars() {
        if c == ZERO_WIDTH_JOINER {
            after_joiner = true;
            continue;
        }
        if is_extender(c) {
            continue;
        }
        if after_joiner {
            after_joiner = false;
            continue;
        }
        if is_regional_indicator(c) && open_flag {
            open_flag = false;
            continue;
        }
        open_flag = is_regional_indicator(c);
        count += 1;
    }
    (!after_joiner).then_some(count)
}

fn is_extender(c: char) -> bool {
    matches!(
        u32::from(c),
        0x0300..=0x036F | 0x20E3 | 0xFE00..=0xFE0F | 0x1_F3FB..=0x1_F3FF | 0xE_0020..=0xE_007F
    )
}

fn is_regional_indicator(c: char) -> bool {
    matches!(u32::from(c), 0x1_F1E6..=0x1_F1FF)
}
