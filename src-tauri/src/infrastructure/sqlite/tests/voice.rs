use std::sync::Arc;

use guild_application::ports::AgentRepository;
use guild_domain::voice::{VoiceIntensity, VoiceSettings};

use super::{saved_agent, temp_dir};
use crate::infrastructure::sqlite::{Database, SqliteAgentRepository};

#[test]
fn voice_constraints_reject_unknown_modes_and_preserve_intensity() {
    let dir = temp_dir("voice-persistence");
    let path = dir.join("guild.db");
    let db = Arc::new(Database::open(&path).unwrap());
    let mut agent = saved_agent(&db, "voice-agent", "ミナ", 1);
    assert_eq!(agent.voice, VoiceSettings::default());
    agent.voice = VoiceSettings { mode: "045".to_owned(), intensity: VoiceIntensity::Medium };
    assert!(SqliteAgentRepository::new(db.clone()).update(&agent).is_err());
    agent.voice.mode = "auto".into();
    SqliteAgentRepository::new(db.clone()).update(&agent).unwrap();
    drop(db);
    let db = Arc::new(Database::open(&path).unwrap());
    let repository = SqliteAgentRepository::new(db.clone());
    assert_eq!(repository.get(&agent.id).unwrap().unwrap().voice.mode, "auto");
    assert_eq!(repository.get(&agent.id).unwrap().unwrap().voice.intensity, VoiceIntensity::Medium);
    agent.voice = VoiceSettings::default();
    repository.update(&agent).unwrap();
    assert_eq!(repository.list().unwrap()[0].voice.mode, "auto");
    drop((repository, db));
    std::fs::remove_dir_all(dir).unwrap();
}
