//! 新しいAPIバックエンドの申告と、モデル設定のディスク保存の往復。

use std::sync::Arc;

use guild_application::ports::AgentRepository;
use guild_domain::agent::Agent;
use guild_domain::backend::BackendInfo;
use guild_domain::ids::AgentId;
use serde_json::{json, Value};

use super::{input, temp_dir};
use crate::infrastructure::sqlite::{Database, SqliteAgentRepository};

#[test]
fn api_backend_models_and_efforts_survive_database_reopen() {
    let fixture: Value =
        serde_json::from_str(include_str!("../../../../../contracts/runner/api-backends.json")).unwrap();
    let backends: Vec<BackendInfo> = serde_json::from_value(fixture.clone()).unwrap();
    assert_eq!(serde_json::to_value(&backends).unwrap(), fixture, "UI/runnerの申告がRustでも同じ形で通る");
    let dir = temp_dir("api-backend-persistence");
    let path = dir.join("guild.db");
    let db = Arc::new(Database::open(&path).unwrap());
    let repository = SqliteAgentRepository::new(db.clone());
    let mut expected = Vec::new();
    for backend in backends {
        for model in backend.models {
            let mut draft = input("worker", &model.id);
            draft.backend = backend.id.clone();
            draft.model = model.id.clone();
            draft.backend_options = json!({"effort": model.efforts.last().unwrap()}).as_object().cloned().unwrap();
            let mut agent = Agent::new(AgentId::new(&model.id), draft, 1);
            repository.insert(&agent).unwrap();
            agent.backend_options = json!({"effort": model.default_effort}).as_object().cloned().unwrap();
            repository.update(&agent).unwrap();
            expected.push(agent);
        }
    }
    drop((repository, db));
    let reopened = Arc::new(Database::open(&path).unwrap());
    let repository = SqliteAgentRepository::new(reopened.clone());
    for agent in expected {
        assert_eq!(repository.get(&agent.id).unwrap(), Some(agent));
    }
    drop((repository, reopened));
    std::fs::remove_dir_all(dir).unwrap();
}
