use guild_domain::theme_backdrop::{
    parse_recipe_json, resolve_text_protection, validate_recipe_cost, ColorEnvelope, ColorExpansion, DrawingCost,
    LayerExpansion, PatternRepeat, Rgba, TextState,
};
use serde_json::{json, Value};

fn fixture(name: &str) -> Vec<Value> {
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../contracts/behavior").join(name);
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{name}: {e}"))
}

fn recipe(name: &Value) -> Value {
    fixture("theme-backdrop-recipe.json")
        .into_iter()
        .find(|v| &v["name"] == name)
        .unwrap_or_else(|| panic!("missing recipe {name}"))["input"]
        .clone()
}

fn rgb(value: &Value) -> [f64; 3] {
    serde_json::from_value(value.clone()).unwrap_or_else(|e| panic!("invalid RGB {value}: {e}"))
}

fn cost(value: &Value) -> DrawingCost {
    DrawingCost {
        primitives: value["primitives"].as_u64().unwrap_or_else(|| panic!("invalid cost {value}")),
        dom: value["dom"].as_u64().unwrap_or_else(|| panic!("invalid cost {value}")),
        definitions: value["definitions"].as_u64().unwrap_or_else(|| panic!("invalid cost {value}")),
        moving_groups: value["movingGroups"].as_u64().unwrap_or_else(|| panic!("invalid cost {value}")),
    }
}

#[test]
fn shared_raw_json_fixtures() {
    for case in fixture("theme-backdrop-raw.json") {
        let raw = case["input"]
            .as_array()
            .unwrap()
            .iter()
            .map(|part| part["text"].as_str().unwrap().repeat(part["count"].as_u64().unwrap().try_into().unwrap()))
            .collect::<String>();
        let result = parse_recipe_json(&raw);
        if case["expected"]["validationErrors"].as_array().unwrap().is_empty() {
            assert_eq!(result.unwrap(), case["expected"]["value"], "{}", case["name"]);
        } else {
            assert_eq!(json!([result.unwrap_err()]), case["expected"]["validationErrors"], "{}", case["name"]);
        }
    }
}

#[test]
fn shared_cost_fixtures() {
    for case in fixture("theme-backdrop-cost.json") {
        let input = &case["input"];
        let mut value = recipe(&input["recipe"]);
        let layers = input["layers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|layer| LayerExpansion {
                cost: cost(&layer["cost"]),
                patterns: layer["patterns"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|p| PatternRepeat {
                        width: p["width"].as_f64().unwrap(),
                        height: p["height"].as_f64().unwrap(),
                        primitives: p["primitives"].as_u64().unwrap(),
                    })
                    .collect(),
            })
            .collect::<Vec<_>>();
        value["layers"] = json!(vec![value["layers"][0].clone(); layers.len()]);
        let before = value.clone();
        let viewport = serde_json::from_value(input["viewport"].clone()).unwrap();
        let result = validate_recipe_cost(&value, viewport, cost(&input["base"]), &layers);
        if case["expected"]["validationErrors"].as_array().unwrap().is_empty() {
            assert_eq!(result.unwrap(), cost(&case["expected"]["cost"]), "{}", case["name"]);
        } else {
            assert_eq!(json!([result.unwrap_err()]), case["expected"]["validationErrors"], "{}", case["name"]);
        }
        assert_eq!(value, before);
    }
}

#[test]
fn shared_color_fixtures() {
    for case in fixture("theme-backdrop-color.json") {
        let input = &case["input"];
        let mut value = recipe(&input["recipe"]);
        let scheme = input["scheme"].as_str().unwrap();
        if !input["palette"].is_null() {
            value["palette"][scheme] = input["palette"].clone();
        }
        let before = value.clone();
        let expansion = &input["expansion"];
        let envelope = ColorEnvelope::from_recipe(
            &value,
            scheme,
            ColorExpansion {
                underlay: (!expansion["underlay"].is_null()).then(|| rgb(&expansion["underlay"])),
                uses_black_shadow: expansion["usesBlackShadow"].as_bool().unwrap(),
            },
        )
        .unwrap();
        let states = [TextState { text: Rgba { rgb: rgb(&input["text"]), alpha: 1.0 }, overlays: vec![] }];
        let result = resolve_text_protection(envelope, Some(rgb(&input["surface"])), &states, false).unwrap();
        assert_eq!(
            json!({"alpha":result.alpha,"verified":result.verified}),
            json!({
                "alpha":case["expected"]["alpha"], "verified":case["expected"]["verified"]
            }),
            "{}",
            case["name"]
        );
        if !case["expected"]["contains"].is_null() {
            let corners = envelope.corners();
            assert_eq!(corners[0], rgb(&case["expected"]["low"]));
            assert_eq!(corners[7], rgb(&case["expected"]["high"]));
            for (c, v) in rgb(&case["expected"]["contains"]).into_iter().enumerate() {
                assert!((corners[0][c]..=corners[7][c]).contains(&v));
            }
        }
        assert_eq!(value, before);
    }
}
