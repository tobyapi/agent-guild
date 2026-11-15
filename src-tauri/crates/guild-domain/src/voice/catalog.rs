use serde::Deserialize;

use crate::skill::builtin_skill_files;

#[derive(Debug, Clone, Deserialize)]
pub struct VoiceMode {
    pub id: String,
    pub title: String,
    pub aliases: Vec<String>,
    pub usage: String,
    pub card: String,
}

#[derive(Deserialize)]
struct Catalog {
    modes: Vec<VoiceMode>,
}

fn resource(path: &str) -> String {
    builtin_skill_files("character-voice")
        .into_iter()
        .find(|file| file.path == path)
        .map(|file| file.content)
        .unwrap_or_default()
}

pub fn voice_modes() -> Vec<VoiceMode> {
    serde_json::from_str::<Catalog>(&resource("references/catalog.json"))
        .map(|catalog| catalog.modes)
        .unwrap_or_default()
}

pub fn mode_card(mode: &VoiceMode) -> String {
    resource(&format!("references/{}", mode.card))
}

pub fn selection_guide() -> String {
    resource("references/selection.md")
}

pub fn appearance_guide() -> String {
    resource("references/appearance.md")
}
