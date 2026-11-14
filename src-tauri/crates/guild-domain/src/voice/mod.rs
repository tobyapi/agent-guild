//! キャラクターの会話文体。文体名と規則は同梱スキルを正とする。

mod catalog;
mod settings;

pub use catalog::{appearance_guide, mode_card, selection_guide, voice_modes, VoiceMode};
pub use settings::{migrate_stored_voice, normalize_voice, VoiceIntensity, VoiceSettings};
