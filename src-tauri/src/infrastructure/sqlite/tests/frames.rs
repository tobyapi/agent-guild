use super::{memory, saved_agent};
use crate::infrastructure::sqlite::{SqliteAgentRepository, SqliteFrameRepository, SqliteProfileRepository};
use guild_application::ports::{AgentRepository, FrameRepository, ProfileRepository};
use guild_domain::frame::{CustomFrame, FrameArt};
use guild_domain::profile::Profile;

#[test]
fn frames_and_choices_are_saved() {
    let db = memory();
    let frames = SqliteFrameRepository::new(db.clone());
    let svg = || FrameArt::Svg { svg: "<svg/>".to_owned() };
    let rose = CustomFrame { id: "custom:1".to_owned(), name: "薔薇".to_owned(), art: svg(), created_at: 2 };
    let chain = CustomFrame { id: "custom:2".to_owned(), name: "鎖".to_owned(), art: FrameArt::Png, created_at: 1 };
    frames.insert(&rose).unwrap();
    frames.insert(&chain).unwrap();
    assert_eq!(frames.list().unwrap(), vec![chain.clone(), rose.clone()], "作成順");
    assert_eq!(frames.get("custom:1").unwrap(), Some(rose));
    frames.delete("custom:1").unwrap();
    assert_eq!(frames.list().unwrap(), vec![chain]);

    let profile = SqliteProfileRepository::new(db.clone());
    profile.set(&Profile { frame: "custom:2".to_owned(), ..Profile::default() }).unwrap();
    assert_eq!(profile.get().unwrap().frame, "custom:2");
    let mut agent = saved_agent(&db, "a1", "ハル", 1);
    agent.frame = "builtin:gears".to_owned();
    SqliteAgentRepository::new(db.clone()).update(&agent).unwrap();
    assert_eq!(SqliteAgentRepository::new(db).list().unwrap()[0].frame, "builtin:gears");
}
