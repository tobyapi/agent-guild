use guild_domain::theme_backdrop::{parse_recipe_json, validate_recipe_structure, RecipeValidationError};
use serde_json::{json, Value};

pub(super) fn recipe() -> Value {
    let cases: Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/theme-backdrop-recipe.json")).unwrap();
    cases[0]["input"].clone()
}

fn rejects(value: &Value, field: &str, code: &'static str) {
    assert_eq!(validate_recipe_structure(value), Err(RecipeValidationError { field: field.into(), code }));
}

#[test]
fn shared_recipes_fix_all_six_successes_and_twelve_diagnostics() {
    let cases: Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/theme-backdrop-recipe.json")).unwrap();
    let mut counts = [0, 0];
    for case in cases.as_array().unwrap() {
        let input = parse_recipe_json(&case["input"].to_string()).unwrap();
        let before = input.clone();
        let errors = validate_recipe_structure(&input).err().into_iter().collect::<Vec<_>>();
        assert_eq!(serde_json::to_value(&errors).unwrap(), case["expected"]["validationErrors"], "{}", case["name"]);
        assert_eq!(errors.is_empty(), case["expected"]["valid"].as_bool().unwrap());
        assert_eq!(input, before);
        counts[usize::from(!errors.is_empty())] += 1;
    }
    assert_eq!(counts, [6, 12]);
}

#[test]
fn numeric_types_and_inclusive_limits_are_enforced() {
    let cases = [
        ("/seed", "seed", 0.0, 4294967295.0, true),
        ("/layers/0/color", "layers[0].color", 1.0, 7.0, true),
        ("/layers/0/scale", "layers[0].scale", 0.25, 1.0, false),
        ("/layers/0/density", "layers[0].density", 0.0, 1.0, false),
        ("/layers/0/depth", "layers[0].depth", 1.0, 3.0, true),
    ];
    for (pointer, field, min, max, integer) in cases {
        let mut value = recipe();
        value["layers"][0]["kind"] = json!("paper");
        value["layers"][0]["density"] = json!(0.5);
        value["palette"]["dark"] = json!(vec!["#000000"; 8]);
        value["palette"]["light"] = json!(vec!["#ffffff"; 8]);
        for invalid in [Value::Null, json!(true), json!("1"), json!([]), json!({})] {
            *value.pointer_mut(pointer).unwrap() = invalid;
            rejects(&value, field, "invalid_type");
        }
        for invalid in [min - 1.0, max + 1.0] {
            *value.pointer_mut(pointer).unwrap() = json!(invalid);
            rejects(&value, field, "out_of_range");
        }
        if integer {
            *value.pointer_mut(pointer).unwrap() = json!(min + 0.5);
            rejects(&value, field, "invalid_type");
        }
        for valid in [min, max] {
            *value.pointer_mut(pointer).unwrap() = json!(valid);
            if pointer.ends_with("density") {
                value["layers"][0]["kind"] = json!("tile");
            }
            assert_eq!(validate_recipe_structure(&value), Ok(()), "{pointer}: {valid}");
        }
    }
}

#[test]
fn required_and_extra_keys_use_only_known_paths() {
    for (pointer, field) in [("", "$"), ("/palette", "palette"), ("/layers/0", "layers[0]")] {
        let base = recipe();
        let keys = base.pointer(pointer).unwrap().as_object().unwrap().keys().cloned().collect::<Vec<_>>();
        for key in keys {
            let mut value = base.clone();
            value.pointer_mut(pointer).unwrap().as_object_mut().unwrap().remove(&key);
            let path = if field == "$" { key } else { format!("{field}.{key}") };
            rejects(&value, &path, "required");
        }
        let mut value = base;
        value.pointer_mut(pointer).unwrap()["private-key"] = json!("private-value");
        rejects(&value, field, "additional_property");
        let diagnostic = format!("{:?}", validate_recipe_structure(&value));
        assert!(!diagnostic.contains("private-"));
    }
}

#[test]
fn title_counts_unicode_scalars_and_forbids_controls() {
    for title in ["a".to_owned(), "界".repeat(40), "😀".repeat(40)] {
        let mut value = recipe();
        value["title"] = json!(title);
        assert_eq!(validate_recipe_structure(&value), Ok(()));
    }
    for title in [
        "".to_owned(),
        "a".repeat(41),
        "😀".repeat(41),
        "a\n".into(),
        "\u{7f}".into(),
        "\u{85}".into(),
        "\u{2028}".into(),
        "\u{2029}".into(),
    ] {
        let mut value = recipe();
        value["title"] = json!(title);
        rejects(&value, "title", "invalid_title");
    }
}

#[test]
fn palette_lengths_colors_and_references_are_checked() {
    for length in [4, 8] {
        let mut value = recipe();
        value["palette"]["dark"] = json!(vec!["#aBcDeF"; length]);
        value["palette"]["light"] = json!(vec!["#012345"; length]);
        value["layers"][0]["color"] = json!(length - 1);
        assert_eq!(validate_recipe_structure(&value), Ok(()));
        value["layers"][0]["color"] = json!(length);
        rejects(&value, "layers[0].color", if length == 8 { "out_of_range" } else { "color_out_of_bounds" });
    }
    for scheme in ["dark", "light"] {
        for length in [0, 3, 9] {
            let mut value = recipe();
            value["palette"][scheme] = json!(vec!["#000000"; length]);
            rejects(&value, &format!("palette.{scheme}"), "invalid_palette_length");
        }
        for color in ["red", "#123", "#12345678", "#GG0000", "#１２３"] {
            let mut value = recipe();
            value["palette"][scheme][1] = json!(color);
            rejects(&value, &format!("palette.{scheme}[1]"), "invalid_color");
        }
    }
    let mut value = recipe();
    value["palette"]["light"].as_array_mut().unwrap().push(json!("#ffffff"));
    rejects(&value, "palette", "palette_length_mismatch");
}

#[test]
fn container_types_versions_and_enums_are_checked() {
    for (pointer, field) in [
        ("", "$"),
        ("/palette", "palette"),
        ("/layers", "layers"),
        ("/layers/0", "layers[0]"),
        ("/title", "title"),
        ("/layers/0/motif", "layers[0].motif"),
    ] {
        let mut value = recipe();
        *value.pointer_mut(pointer).unwrap() = Value::Null;
        rejects(&value, field, "invalid_type");
    }
    for (pointer, field, code) in [
        ("/schemaVersion", "schemaVersion", "unsupported_version"),
        ("/catalogVersion", "catalogVersion", "unsupported_catalog"),
    ] {
        for invalid in [json!("1"), json!(1.5), Value::Null] {
            let mut value = recipe();
            *value.pointer_mut(pointer).unwrap() = invalid;
            rejects(&value, field, "invalid_type");
        }
        let mut value = recipe();
        *value.pointer_mut(pointer).unwrap() = json!(2);
        rejects(&value, field, code);
    }
    for (pointer, field, code) in [
        ("/composition", "composition", "unsupported_composition"),
        ("/layers/0/anchor", "layers[0].anchor", "unsupported_anchor"),
    ] {
        let mut value = recipe();
        *value.pointer_mut(pointer).unwrap() = json!("unknown");
        rejects(&value, field, code);
    }
    let mut value = recipe();
    value["layers"] = json!([]);
    rejects(&value, "layers", "too_few_layers");
    value["layers"] = json!(vec![recipe()["layers"][0].clone(); 8]);
    assert_eq!(validate_recipe_structure(&value), Ok(()));
}
