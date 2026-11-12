//! 契約の実例（contracts/runner/*.jsonl）を読み、解釈できること・書き戻した値が元と一致することを確かめる。

use std::path::PathBuf;

use serde_json::Value;

use super::{parse_event, runner_error, Event, Request};
use crate::{BackendInfo, ErrorCode, RunRequest, RunnerError};

fn fixture(name: &str) -> Vec<Value> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../contracts/runner").join(name);
    let text =
        std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{} を読めません: {error}", path.display()));
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).expect("JSON として読めない行がある"))
        .collect()
}

#[test]
fn requests_fixture_round_trips() {
    let lines = fixture("requests.jsonl");
    assert!(lines.len() >= 4, "run / cancel / probe / shutdown の実例があること");
    for expected in lines {
        let id = expected["id"].as_str().unwrap_or_default();
        let actual = match expected["type"].as_str() {
            Some("run") => {
                let request: RunRequest =
                    serde_json::from_value(expected.clone()).expect("run を RunRequest として読めない");
                serde_json::to_value(Request::Run { id, request: &request })
            }
            Some("login") => {
                let backend = expected["backend"].as_str().unwrap_or_default();
                serde_json::to_value(Request::Login { id, backend })
            }
            Some("apiKey") => serde_json::to_value(Request::ApiKey {
                id,
                backend: expected["backend"].as_str().unwrap_or_default(),
                action: expected["action"].as_str().unwrap_or_default(),
                key: None,
            }),
            Some("cancel") => serde_json::to_value(Request::Cancel { id }),
            Some("probe") => serde_json::to_value(Request::Probe { id }),
            Some("setLanguage") => {
                let language = expected["language"].as_str().unwrap_or_default();
                serde_json::to_value(Request::SetLanguage { language })
            }
            Some("shutdown") => serde_json::to_value(Request::Shutdown),
            other => panic!("知らない要求の実例: {other:?}"),
        };
        assert_eq!(actual.expect("JSON にできない"), expected);
    }
}

#[test]
fn events_fixture_round_trips() {
    for expected in fixture("events.jsonl") {
        let event: Event = serde_json::from_value(expected.clone()).expect("イベントとして読めない");
        assert!(!matches!(event, Event::Unknown), "未知のイベント扱いになった: {expected}");
        if let Event::Ready(ready) = &event {
            let backends: Vec<BackendInfo> = serde_json::from_value(ready.backends.clone()).expect("ready の backends");
            assert_eq!(serde_json::to_value(&backends).expect("JSON にできない"), ready.backends);
        }
        assert_eq!(serde_json::to_value(&event).expect("JSON にできない"), expected);
    }
}

#[test]
fn error_codes_map_to_runner_errors() {
    assert!(matches!(runner_error("cancelled", String::new()), RunnerError::Cancelled));
    let cases = [
        ("auth", ErrorCode::Auth),
        ("rate_limit", ErrorCode::RateLimit),
        ("model_not_found", ErrorCode::ModelNotFound),
        ("unknown_backend", ErrorCode::UnknownBackend),
        ("unsupported_permission", ErrorCode::UnsupportedPermission),
        ("bad_request", ErrorCode::BadRequest),
        ("internal", ErrorCode::Internal),
        ("added_in_the_future", ErrorCode::Internal),
    ];
    for (wire, expected) in cases {
        let error = runner_error(wire, "失敗".to_owned());
        assert!(matches!(error, RunnerError::Backend { code, .. } if code == expected), "{wire}");
    }
}

#[test]
fn unknown_types_and_fields_are_ignored() {
    assert!(matches!(parse_event(r#"{"type":"telemetry","x":1}"#), Ok(Event::Unknown)));
    let activity = parse_event(r#"{"type":"activity","id":"j1","detail":"考え中…","extra":true}"#);
    assert!(matches!(activity, Ok(Event::Activity { id, .. }) if id == "j1"));
}

#[test]
fn request_is_one_line_even_with_newlines() {
    let line = Request::Cancel { id: "a\nb" }.to_line().expect("1行にできる");
    assert!(line.ends_with('\n'));
    assert!(!line.trim_end_matches('\n').contains('\n'));
}
