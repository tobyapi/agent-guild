use serde::{Deserialize, Serialize};
use unicode_normalization::UnicodeNormalization;

use crate::{error::ValidationError, locale};

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VoiceIntensity {
    #[default]
    Weak,
    Medium,
    Strong,
}

impl VoiceIntensity {
    pub fn label(self) -> &'static str {
        match self {
            Self::Weak => "弱",
            Self::Medium => "中",
            Self::Strong => "強",
        }
    }
}

/// 古い保存データにはないので、自動・弱を既定にする。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct VoiceSettings {
    /// auto / off。旧形式の保存値は読み込み時に auto へ移す。
    pub mode: String,
    pub intensity: VoiceIntensity,
}

impl Default for VoiceSettings {
    fn default() -> Self {
        Self { mode: "auto".to_owned(), intensity: VoiceIntensity::Weak }
    }
}

pub fn normalize_voice(mut voice: VoiceSettings) -> Result<VoiceSettings, ValidationError> {
    let key = voice.mode.nfkc().collect::<String>().trim().to_lowercase();
    voice.mode = match key.as_str() {
        "auto" | "自動" => "auto".to_owned(),
        "off" | "通常" | "いつもの口調" => "off".to_owned(),
        _ => {
            return Err({
                ValidationError::on(
                    "voice",
                    locale::pick([
                        "文体は自動かいつもの口調を選んでください",
                        "Choose automatic or usual voice",
                        "请选择自动或平时的语气",
                        "請選擇自動或平時的語氣",
                        "자동 또는 평소 말투를 선택하십시오",
                    ]),
                )
            })
        }
    };
    Ok(voice)
}

pub fn migrate_stored_voice(mut voice: VoiceSettings) -> VoiceSettings {
    voice.mode = if normalize_voice(voice.clone()).ok().is_some_and(|value| value.mode == "off") {
        "off".to_owned()
    } else {
        "auto".to_owned()
    };
    voice
}
