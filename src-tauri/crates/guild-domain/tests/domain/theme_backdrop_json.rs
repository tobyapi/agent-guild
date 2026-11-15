use guild_domain::theme_backdrop::{parse_recipe_json, RecipeValidationError};
use serde_json::{json, Value};

fn assert_rejected(input: &str, code: &'static str) {
    assert_eq!(parse_recipe_json(input), Err(RecipeValidationError { field: "$".into(), code }));
}

#[test]
fn malformed_json_is_rejected_without_repair() {
    for input in ["", "{", "{\"a\":}", "{} trailing", "{} {}", "```json\n{}\n```", "NaN", "1e400"] {
        assert_rejected(input, "invalid_json");
    }
    assert_eq!(parse_recipe_json(" \n{}\t"), Ok(json!({})));
}

#[test]
fn byte_limit_is_inclusive_and_counts_utf8() {
    let at_limit = format!("\"{}\"", "é".repeat((32 * 1024 - 2) / 2));
    assert_eq!(at_limit.len(), 32 * 1024);
    assert!(parse_recipe_json(&at_limit).is_ok());
    assert_rejected(&(at_limit + " "), "input_too_large");
}

#[test]
fn container_depth_limit_is_inclusive_for_arrays_and_objects() {
    // The root array/object counts as depth 1; scalar values do not add depth.
    for depth in [8, 9] {
        for input in [
            format!("{}0{}", "[".repeat(depth), "]".repeat(depth)),
            format!("{}0{}", "{\"a\":".repeat(depth), "}".repeat(depth)),
            format!("{}[]{}", "[".repeat(depth - 1), "]".repeat(depth - 1)),
            format!("{}[0]{}", "{\"a\":".repeat(depth - 1), "}".repeat(depth - 1)),
        ] {
            if depth == 8 {
                assert!(parse_recipe_json(&input).is_ok());
            } else {
                assert_rejected(&input, "nesting_too_deep");
            }
        }
    }
}

#[test]
fn duplicate_keys_are_rejected_at_root_and_inside_layers() {
    for input in
        [r#"{"secret":1,"secret":2}"#, r#"{"layers":[{"kind":"tile","kind":"paper"}]}"#, r#"{"kind":1,"\u006bind":2}"#]
    {
        assert_rejected(input, "duplicate_key");
    }
    assert!(parse_recipe_json(r#"{"layers":[{"kind":"tile"},{"kind":"paper"}]}"#).is_ok());
}

#[test]
fn shared_valid_recipes_pass_the_json_gate_unchanged() {
    let fixtures: Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/theme-backdrop-recipe.json")).unwrap();
    let mut count = 0;
    for case in fixtures.as_array().unwrap() {
        if case["expected"]["valid"] == true {
            let input = case["input"].to_string();
            assert_eq!(parse_recipe_json(&input).unwrap(), case["input"]);
            count += 1;
        }
    }
    assert_eq!(count, 6);
}

#[test]
fn diagnostics_contain_only_app_owned_field_and_code() {
    let inputs = [
        (format!("\"{}\"", "private-value".repeat(3000)), "input_too_large"),
        (r#"{"private-key":"private-value"} trailing"#.to_owned(), "invalid_json"),
        (format!("{}0{}", "{\"private-key\":".repeat(9), "}".repeat(9)), "nesting_too_deep"),
        (r#"{"private-key":"private-value","private-key":0}"#.to_owned(), "duplicate_key"),
    ];
    for (input, code) in inputs {
        let error = parse_recipe_json(&input).unwrap_err();
        assert_eq!(serde_json::to_value(&error).unwrap(), json!({"field":"$","code":code}));
        let diagnostic = format!("{error:?}");
        assert!(!diagnostic.contains("private-key"));
        assert!(!diagnostic.contains("private-value"));
    }
}
