//! backendOptions（バックエンド固有設定）の検証: 項目定義（OptionSpec）と、選んだモデルが選べる推論の深さに合わせる。

use serde_json::{Map, Value};

use super::{BackendInfo, OptionSpec, OptionType, EFFORT_OPTION};
use crate::error::ValidationError;
use crate::locale;

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
                let label = &spec.label;
                return Err(invalid(locale::pick([
                    format!("「{label}」の値が正しくありません"),
                    format!("The value of “{label}” is invalid"),
                    format!("“{label}”的值不正确"),
                    format!("「{label}」的值不正確"),
                    format!("\"{label}\"의 값이 올바르지 않습니다"),
                ])));
            }
        }
        result.insert(key, value);
    }
    Ok(result)
}

fn ensure_effort(value: &Value, info: &BackendInfo, model: &str) -> Result<(), ValidationError> {
    let Some(effort) = value.as_str() else {
        return Err(invalid(
            locale::pick([
                "推論の深さの値が正しくありません",
                "The reasoning effort value is invalid",
                "推理深度的值不正确",
                "推理深度的值不正確",
                "추론 깊이 값이 올바르지 않습니다",
            ])
            .to_owned(),
        ));
    };
    let Some(spec) = info.model_spec(model) else {
        return Ok(());
    };
    if spec.efforts.iter().any(|choice| choice == effort) {
        return Ok(());
    }
    let label = &spec.label;
    let message = if spec.efforts.is_empty() {
        locale::pick([
            format!("「{label}」では推論の深さを選べません"),
            format!("Reasoning effort cannot be chosen for “{label}”"),
            format!("“{label}”不能选择推理深度"),
            format!("「{label}」無法選擇推理深度"),
            format!("\"{label}\"에서는 추론 깊이를 선택할 수 없습니다"),
        ])
    } else {
        locale::pick([
            format!("「{label}」では推論の深さ「{effort}」を選べません"),
            format!("Reasoning effort “{effort}” cannot be chosen for “{label}”"),
            format!("“{label}”不能选择推理深度“{effort}”"),
            format!("「{label}」無法選擇推理深度「{effort}」"),
            format!("\"{label}\"에서는 추론 깊이 \"{effort}\"을(를) 선택할 수 없습니다"),
        ])
    };
    Err(invalid(message))
}

fn accepts(spec: &OptionSpec, value: &Value) -> bool {
    match spec.value_type {
        OptionType::String => value.is_string(),
        OptionType::Number => value.is_number(),
        OptionType::Boolean => value.is_boolean(),
        OptionType::Select => value.as_str().is_some_and(|choice| spec.choices.iter().any(|c| c == choice)),
    }
}

fn invalid(message: String) -> ValidationError {
    ValidationError::on("backendOptions", message)
}
