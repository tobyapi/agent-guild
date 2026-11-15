use guild_domain::theme_backdrop::{resolve_text_protection, ColorEnvelope, ColorExpansion, Rgba, TextState};
use serde_json::{json, Value};

use super::theme_backdrop_structure::recipe;

fn alpha(envelope: ColorEnvelope, surface: [f64; 3], text: [f64; 3]) -> f64 {
    let states = [TextState { text: Rgba { rgb: text, alpha: 1.0 }, overlays: vec![] }];
    let result = resolve_text_protection(envelope, Some(surface), &states, false).unwrap();
    assert!(result.verified);
    result.alpha
}

#[test]
fn conditional_shadow_covers_both_schemes_and_cannot_reduce_required_protection() {
    let mut value = recipe();
    value["palette"]["light"] = json!(["#cccccc", "#dddddd", "#eeeeee", "#ffffff"]);
    value["palette"]["dark"] = json!(["#111111", "#222222", "#333333", "#444444"]);
    for (scheme, surface, text) in [("light", [1.0; 3], [0.0; 3]), ("dark", [0.0; 3], [1.0; 3])] {
        let make = |uses_black_shadow| {
            ColorEnvelope::from_recipe(&value, scheme, ColorExpansion { underlay: None, uses_black_shadow }).unwrap()
        };
        let plain = make(false);
        let shadow = make(true);
        assert!(plain.corners()[0].iter().all(|c| *c > 0.0));
        assert_eq!(shadow.corners()[0], [0.0; 3]);
        assert!(alpha(plain, surface, text) <= alpha(shadow, surface, text));
        if scheme == "light" {
            assert!(alpha(plain, surface, text) < alpha(shadow, surface, text));
        }
    }
}

#[test]
fn underlay_extends_both_bounds_and_invalid_underlay_is_rejected() {
    let mut value = recipe();
    value["palette"]["light"] = json!(vec!["#808080"; 4]);
    let envelope = ColorEnvelope::from_recipe(
        &value,
        "light",
        ColorExpansion { underlay: Some([0.0, 1.0, 0.5]), uses_black_shadow: false },
    )
    .unwrap();
    assert_eq!(envelope.corners()[0], [0.0, 128.0 / 255.0, 0.5]);
    assert_eq!(envelope.corners()[7], [128.0 / 255.0, 1.0, 128.0 / 255.0]);
    for invalid in [f64::NAN, f64::INFINITY, -0.1, 1.1] {
        let error = ColorEnvelope::from_recipe(
            &value,
            "light",
            ColorExpansion { underlay: Some([invalid; 3]), uses_black_shadow: false },
        )
        .unwrap_err();
        assert_eq!((error.field.as_str(), error.code), ("$", "invalid_expansion"));
    }
}

#[test]
fn red_green_midpoint_is_inside_box_and_darker_than_either_endpoint() {
    let mut value = recipe();
    value["palette"]["light"] = json!(["#ff0000", "#00ff00", "#ff0000", "#00ff00"]);
    let envelope =
        ColorEnvelope::from_recipe(&value, "light", ColorExpansion { underlay: None, uses_black_shadow: false })
            .unwrap();
    let midpoint = [0.5, 0.5, 0.0];
    let corners = envelope.corners();
    for (channel, value) in midpoint.into_iter().enumerate() {
        assert!((corners[0][channel]..=corners[7][channel]).contains(&value));
    }
    let luminance = (0.2126 + 0.7152) * ((0.5_f64 + 0.055) / 1.055).powf(2.4);
    assert!((luminance - 0.198587).abs() < 0.000001);
    assert!(luminance < 0.2126 && luminance < 0.7152);
    // A background equal to the text must not pass at alpha zero.
    assert!(alpha(envelope, [0.0; 3], midpoint) > 0.0);
}

#[test]
fn shared_six_alpha_comparison_preserves_legacy_results_and_inputs() {
    let cases: Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/theme-backdrop-recipe.json")).unwrap();
    for case in cases.as_array().unwrap().iter().take(6) {
        let before = case["input"].clone();
        for (scheme, surface, text) in [("light", [1.0; 3], [0.0; 3]), ("dark", [0.0; 3], [1.0; 3])] {
            // Shadow=true and no underlay reproduces the previous lo=0 formula exactly.
            let old =
                ColorEnvelope::from_recipe(&before, scheme, ColorExpansion { underlay: None, uses_black_shadow: true })
                    .unwrap();
            let new = ColorEnvelope::from_recipe(
                &before,
                scheme,
                ColorExpansion { underlay: Some(surface), uses_black_shadow: false },
            )
            .unwrap();
            let shadow = ColorEnvelope::from_recipe(
                &before,
                scheme,
                ColorExpansion { underlay: Some(surface), uses_black_shadow: true },
            )
            .unwrap();
            let old_alpha = alpha(old, surface, text);
            let new_alpha = alpha(new, surface, text);
            assert!(new_alpha <= alpha(shadow, surface, text));
            println!("{} | {scheme} | {old_alpha:.3} | {new_alpha:.3}", case["name"].as_str().unwrap());
        }
        assert_eq!(before, case["input"]);
    }
}
