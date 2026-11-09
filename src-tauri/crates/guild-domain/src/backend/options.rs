//! backendOptions（バックエンド固有設定）の検証: 項目定義（OptionSpec）と、選んだモデルが選べる推論の深さに合わせる。

use serde_json::{Map, Value};

use super::{BackendInfo, OptionSpec, OptionType, EFFORT_OPTION};
use crate::error::ValidationError;

/// backendOptions を項目定義に合わせる: 未知のキーと null（＝既定値）は捨て、型が合わない値は拒否する。
/// 推論の深さ（EFFORT_OPTION）は、モデル（空なら既定のモデル）が一覧にあればその efforts のどれかだけを受け付け、
/// 一覧に無いモデル（自由入力・一覧が分からない）なら文字列であれば残す（使えない値はランナーが無視する）
pub fn sanitize_backend_options(
    options: Map<String, Value>,
    info: &BackendInfo,
    model: &str,
) -> Result<Map<String, Value>, ValidationError> {
    let mut result = Map::new();
    for (key, value) in options {
        if value.is_null() {
            continue;
        }
        if key == EFFORT_OPTION {
            ensure_effort(&value, info, model)?;
        } else {
            let Some(spec) = info.options.iter().find(|spec| spec.key == key) else {
                continue;
            };
            if !accepts(spec, &value) {
                return Err(invalid(format!("「{}」の値が正しくありません", spec.label)));
            }
        }
        result.insert(key, value);
    }
    Ok(result)
}

fn ensure_effort(value: &Value, info: &BackendInfo, model: &str) -> Result<(), ValidationError> {
    let Some(effort) = value.as_str() else {
        return Err(invalid("推論の深さの値が正しくありません".to_owned()));
    };
    let Some(spec) = info.model_spec(model) else {
        return Ok(());
    };
    if spec.efforts.iter().any(|choice| choice == effort) {
        return Ok(());
    }
    let message = if spec.efforts.is_empty() {
        format!("「{}」では推論の深さを選べません", spec.label)
    } else {
        format!("「{}」では推論の深さ「{effort}」を選べません", spec.label)
    };
    Err(invalid(message))
}

fn accepts(spec: &OptionSpec, value: &Value) -> bool {
    match spec.value_type {
        OptionType::String => value.is_string(),
        OptionType::Number => value.is_number(),
        OptionType::Boolean => value.is_boolean(),
        OptionType::Select => value
            .as_str()
            .is_some_and(|choice| spec.choices.iter().any(|c| c == choice)),
    }
}

fn invalid(message: String) -> ValidationError {
    ValidationError::on("backendOptions", message)
}
