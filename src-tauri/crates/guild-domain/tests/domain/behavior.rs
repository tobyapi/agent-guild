//! Rust と TS（モックのバックエンドと画面）が同じ結果を出すことを確かめる、振る舞いの実例
//! （contracts/behavior/*.json）。同じファイルを vitest も読む（contracts/README.md）。
//! 規則を変えたら、実例と両方の実装を同じ変更で直す。

use std::fs;
use std::path::PathBuf;

use guild_domain::agent::Agent;
use guild_domain::conversation::{notices, parse_mentions};
use guild_domain::delegation::{parse_tasks, SubtaskNote};
use guild_domain::ids::AgentId;
use guild_domain::locale::Language;
use serde_json::{json, Value};

use crate::support::agent;

fn fixture(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../contracts/behavior").join(name);
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("{} を読めません: {e}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{name} は JSON ではありません: {e}"))
}

fn text(value: &Value) -> &str {
    value.as_str().unwrap_or_else(|| panic!("文字列ではありません: {value}"))
}

fn items(value: &Value) -> &[Value] {
    value.as_array().unwrap_or_else(|| panic!("配列ではありません: {value}"))
}

fn names(value: &Value) -> Vec<String> {
    items(value).iter().map(|name| text(name).to_owned()).collect()
}

/// 実例のエージェント（{ id, name, deleted? }）
fn agents(list: &Value) -> Vec<Agent> {
    let build = |entry: &Value| {
        let mut agent = agent(text(&entry["id"]), "worker", text(&entry["name"]));
        if entry["deleted"] == json!(true) {
            agent.deleted_at = Some(1);
        }
        agent
    };
    items(list).iter().map(build).collect()
}

#[test]
fn mentions_follow_the_shared_examples() {
    let cases = fixture("mentions.json");
    assert!(!items(&cases).is_empty());
    for case in items(&cases) {
        let found = parse_mentions(text(&case["content"]), &agents(&case["agents"]));
        let found: Vec<&str> = found.iter().map(AgentId::as_str).collect();
        let expected: Vec<&str> = items(&case["mentions"]).iter().map(text).collect();
        assert_eq!(found, expected, "{}", text(&case["name"]));
    }
}

#[test]
fn tasks_blocks_follow_the_shared_examples() {
    let teams = fixture("tasks-agents.json");
    let author = AgentId::new(text(&teams["author"]));
    let cases = fixture("tasks.json");
    assert!(!items(&cases).is_empty());
    for case in items(&cases) {
        let members = agents(&teams["teams"][text(&case["agents"])]);
        let actual = parse_tasks(text(&case["content"]), &author, &members).map_or(Value::Null, |plan| {
            let task = |task: &guild_domain::delegation::PlannedTask| {
                json!({ "assignee": task.assignee.as_str(), "instruction": task.instruction })
            };
            let tasks: Vec<Value> = plan.tasks.iter().map(task).collect();
            json!({ "tasks": tasks, "unassignable": plan.unassignable, "overflow": plan.overflow })
        });
        assert_eq!(actual, case["plan"], "{}", text(&case["name"]));
    }
}

/// 1つの言語の文面（実例の名前を使って作る）
fn notices_in(language: Language, expected: &Value) -> Value {
    let one = |key: &str, write: fn(Language, &str) -> String| {
        let name = text(&expected[key]["name"]);
        json!({ "name": name, "text": write(language, name) })
    };
    let many = |key: &str, write: fn(Language, &[String]) -> String| {
        let list = names(&expected[key]["names"]);
        json!({ "names": list, "text": write(language, &list) })
    };
    let note = |note: SubtaskNote| note.text(language);
    json!({
        "stopped": notices::stopped(language),
        "depthLimit": notices::depth_limit(language),
        "noResponder": notices::no_responder(language),
        "timedOut": notices::timed_out(language),
        "joined": one("joined", notices::joined),
        "undeliverable": one("undeliverable", notices::undeliverable),
        "didNotAnswer": one("didNotAnswer", notices::did_not_answer),
        "failed": one("failed", notices::failed),
        "unassignable": many("unassignable", notices::unassignable),
        "tooManyTasks": many("tooManyTasks", notices::too_many_tasks),
        "interrupted": many("interrupted", notices::interrupted),
        "subtaskNotes": {
            "noAnswer": note(SubtaskNote::NoAnswer),
            "runFailed": note(SubtaskNote::RunFailed),
            "timedOut": note(SubtaskNote::TimedOut),
            "assigneeRemoved": note(SubtaskNote::AssigneeRemoved),
            "notStarted": note(SubtaskNote::NotStarted),
        },
    })
}

/// 実例は言語のコードごとに同じ形（{ "ja": {...}, "en": {...}, ... }）
#[test]
fn notices_follow_the_shared_examples() {
    let fixture = fixture("notices.json");
    for language in Language::ALL {
        let expected = &fixture[language.code()];
        assert!(expected.is_object(), "{} の実例がありません", language.code());
        assert_eq!(notices_in(language, expected), *expected, "{}", language.code());
    }
}
