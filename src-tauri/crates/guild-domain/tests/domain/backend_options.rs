//! backendOptions の検証: 項目定義（OptionSpec）と、モデルごとに選べる推論の深さ。

use guild_domain::agent::normalize_agent_input;
use guild_domain::backend::{BackendInfo, ModelSpec, OptionSpec, OptionType};
use serde_json::{json, Value};

use super::support::{backend, input};

/// model と backendOptions を保存したときの backendOptions（失敗ならエラーの文言）
fn saved(info: &BackendInfo, model: &str, options: Value) -> Result<Value, String> {
    let mut raw = input("worker", "ソラ");
    raw.model = model.to_owned();
    raw.backend_options = options.as_object().cloned().unwrap_or_default();
    normalize_agent_input(raw, Some(info))
        .map(|input| Value::Object(input.backend_options))
        .map_err(|error| error.message().to_owned())
}

fn model(id: &str, efforts: &[&str]) -> ModelSpec {
    ModelSpec {
        id: id.to_owned(),
        label: format!("{id}の名前"),
        description: String::new(),
        efforts: efforts.iter().map(|effort| (*effort).to_owned()).collect(),
        default_effort: None,
    }
}

#[test]
fn options_follow_the_option_specs() {
    let spec = |key: &str, value_type, choices: &[&str]| OptionSpec {
        key: key.to_owned(),
        label: key.to_owned(),
        description: String::new(),
        value_type,
        choices: choices.iter().map(|c| (*c).to_owned()).collect(),
        default: Value::Null,
    };
    let mut info = backend("codex");
    info.options =
        vec![spec("maxTurns", OptionType::Number, &[]), spec("sandbox", OptionType::Select, &["read", "write"])];
    let raw = json!({ "maxTurns": 5, "sandbox": "write", "unknown": 1, "x": null });
    assert_eq!(saved(&info, "", raw), Ok(json!({ "maxTurns": 5, "sandbox": "write" })));
    assert!(saved(&info, "", json!({ "sandbox": "all" })).is_err());
    assert!(saved(&info, "", json!({ "maxTurns": "5" })).is_err());
}

#[test]
fn effort_must_be_one_the_model_offers() {
    let mut info = backend("claude");
    info.models = vec![model("opus", &["low", "max"]), model("haiku", &[])];
    info.default_model = "opus".to_owned();
    assert_eq!(saved(&info, "opus", json!({ "effort": "max" })), Ok(json!({ "effort": "max" })));
    assert_eq!(
        saved(&info, "", json!({ "effort": "low" })),
        Ok(json!({ "effort": "low" })),
        "空なら既定のモデルで確かめる"
    );
    let unknown = saved(&info, "opus", json!({ "effort": "ultra" }));
    assert_eq!(unknown, Err("「opusの名前」では推論の深さ「ultra」を選べません".to_owned()));
    let none = saved(&info, "haiku", json!({ "effort": "low" }));
    assert_eq!(none, Err("「haikuの名前」では推論の深さを選べません".to_owned()));
    assert!(saved(&info, "opus", json!({ "effort": 3 })).is_err());
    assert_eq!(saved(&info, "haiku", json!({ "effort": null })), Ok(json!({})), "null は選ばない（既定）");
}

#[test]
fn effort_for_an_unlisted_model_is_kept() {
    let mut info = backend("codex");
    info.models = vec![model("gpt", &["low"])];
    assert_eq!(
        saved(&info, "my-model", json!({ "effort": "high" })),
        Ok(json!({ "effort": "high" })),
        "自由入力のモデル"
    );
    let unknown_catalog = saved(&backend("codex"), "", json!({ "effort": "high" }));
    assert_eq!(unknown_catalog, Ok(json!({ "effort": "high" })), "モデルの一覧が分からない");
}
