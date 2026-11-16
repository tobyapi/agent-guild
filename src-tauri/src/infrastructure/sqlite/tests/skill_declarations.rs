//! 本文内の使用申告は、実ファイルのDBを閉じて開き直しても投稿ごとに保持する。

use std::fs;
use std::sync::Arc;

use guild_application::ports::{ChannelRepository, MessageFilter, MessageRepository};
use guild_domain::author::Author;
use guild_domain::ids::{AgentId, ChannelId};
use guild_domain::message::{MessageKind, NewMessage};

use super::channels_messages::{lobby, new_message};
use super::temp_dir;
use crate::infrastructure::sqlite::{Database, SqliteChannelRepository, SqliteMessageRepository};

#[test]
fn skill_declarations_survive_database_reopen_without_crossing_messages() {
    let dir = temp_dir("skill-declarations");
    let path = dir.join("guild.db");
    let db = Arc::new(Database::open(&path).unwrap());
    SqliteChannelRepository::new(db.clone()).insert(&lobby()).unwrap();
    let repository = SqliteMessageRepository::new(db.clone());
    let progress = NewMessage {
        kind: MessageKind::Progress,
        skill_usage: Some(guild_domain::skill_usage::SkillUsage {
            declared: vec!["clean-code".into()],
            loaded: vec!["reflection".into()],
            supported: true,
            run_id: Some("run-a".into()),
            interval: Some(guild_domain::skill_usage::SkillInterval {
                version: 1,
                agent_id: "a".into(),
                start: 0,
                end: 2,
                incomplete: false,
                observations: vec![guild_domain::skill_usage::SkillRead {
                    name: "reflection".into(),
                    tool_call_id: "backend:call-a".into(),
                    sequence: 1,
                }],
            }),
        }),
        ..new_message("progress", "途中\n```skill-usage\n[\"clean-code\",\"reflection\"]\n```")
    };
    let other = NewMessage {
        author_id: Author::Agent(AgentId::new("b")),
        ..new_message("other", "別エージェントの記録なし")
    };
    let messages = [progress, new_message("final", "同じエージェントの最終返答"), other];
    let expected: Vec<_> = messages.into_iter().map(|message| repository.insert(message).unwrap()).collect();
    drop((repository, db));

    let reopened = Arc::new(Database::open(&path).unwrap());
    let repository = SqliteMessageRepository::new(reopened.clone());
    let restored = repository.list(&ChannelId::new("c1"), MessageFilter::All, None, 10).unwrap();
    assert_eq!(restored, expected);
    for message in &expected {
        assert_eq!(repository.get(&message.id).unwrap(), Some(message.clone()));
    }
    drop((repository, reopened));
    fs::remove_dir_all(dir).unwrap();
}
