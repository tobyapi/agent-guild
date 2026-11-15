use guild_domain::theme_backdrop::{resolve_text_protection, ColorEnvelope, ColorExpansion, Rgba, TextState};
use serde_json::json;

use super::theme_backdrop_structure::recipe;

fn alpha(envelope: ColorEnvelope, surface: [f64; 3], text: [f64; 3]) -> f64 {
    let states = [TextState { text: Rgba { rgb: text, alpha: 1.0 }, overlays: vec![] }];
    let result = match resolve_text_protection(envelope, Some(surface), &states, false) {
        Ok(result) => result,
        Err(error) => panic!("expected a valid protection: {error:?}"),
    };
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
