use guild_domain::theme_backdrop::{resolve_text_protection, ColorEnvelope, ColorExpansion, Rgba, TextState};
use serde_json::{json, Value};

use super::theme_backdrop_structure::recipe;

const SHADOW: ColorExpansion = ColorExpansion { underlay: None, uses_black_shadow: true };

fn state(rgb: [f64; 3], alpha: f64) -> TextState {
    TextState { text: Rgba { rgb, alpha }, overlays: vec![] }
}

#[test]
fn envelope_enumerates_eight_corners_and_contains_mixed_intermediate_colors() {
    let mut value = recipe();
    value["palette"]["dark"] = json!(["#000000", "#ff0000", "#00ff00", "#0000ff"]);
    let corners = ColorEnvelope::from_recipe(&value, "dark", SHADOW).unwrap().corners();
    assert_eq!(corners.len(), 8);
    for (mask, corner) in corners.iter().enumerate() {
        assert_eq!(*corner, std::array::from_fn(|c| f64::from(u8::from(mask & (1 << c) != 0))));
    }
    // Endpoints alone miss an intermediate background equal to gray text (contrast 1).
    let protection = resolve_text_protection(
        ColorEnvelope::from_recipe(&value, "dark", SHADOW).unwrap(),
        Some([0.0; 3]),
        &[state([0.5; 3], 1.0)],
        false,
    )
    .unwrap();
    assert!(protection.alpha > 0.0 && protection.verified);
}

#[test]
fn opaque_fallback_accepts_455_but_rejects_449_and_translucent_text_is_composited() {
    let envelope = ColorEnvelope::from_recipe(&recipe(), "dark", SHADOW).unwrap();
    let gray = |ratio: f64| 1.055 * ((ratio - 1.0) * 0.05).powf(1.0 / 2.4) - 0.055;
    let result = resolve_text_protection(envelope, Some([0.0; 3]), &[state([gray(4.55); 3], 1.0)], false).unwrap();
    assert_eq!(result.alpha, 1.0);
    assert!(result.verified);
    assert!(resolve_text_protection(envelope, Some([0.0; 3]), &[state([gray(4.49); 3], 1.0)], false).is_err());
    let opaque = resolve_text_protection(envelope, Some([0.0; 3]), &[state([1.0; 3], 1.0)], false).unwrap();
    let translucent = resolve_text_protection(envelope, Some([0.0; 3]), &[state([1.0; 3], 0.6)], false).unwrap();
    assert!(translucent.alpha > opaque.alpha);
}

#[test]
fn alpha_search_uses_first_thousandth_and_respects_both_thresholds() {
    let mut value = recipe();
    value["palette"]["dark"] = json!(vec!["#ffffff"; 4]);
    let envelope = ColorEnvelope::from_recipe(&value, "dark", SHADOW).unwrap();
    let protection = resolve_text_protection(envelope, Some([0.0; 3]), &[state([1.0; 3], 1.0)], false).unwrap();
    let linear_limit: f64 = 1.05 / 4.6 - 0.05;
    let maximum_srgb = 1.055 * linear_limit.powf(1.0 / 2.4) - 0.055;
    let expected = ((1.0 - maximum_srgb) * 1000.0).ceil() / 1000.0;
    assert_eq!(protection.alpha, expected);
    assert_eq!(resolve_text_protection(envelope, Some([0.0; 3]), &[state([1.0; 3], 1.0)], true).unwrap().alpha, 1.0);
    assert_eq!(
        resolve_text_protection(envelope, Some([0.5; 3]), &[state([0.5; 3], 1.0)], true).unwrap_err().code,
        "text_protection_failed"
    );
}

#[test]
fn translucent_text_state_overlays_and_unresolved_tokens_are_not_ignored() {
    let envelope = ColorEnvelope::from_recipe(&recipe(), "dark", SHADOW).unwrap();
    let mut bad = state([1.0; 3], 1.0);
    bad.overlays.push(Rgba { rgb: [1.0; 3], alpha: 1.0 });
    assert!(resolve_text_protection(envelope, Some([0.0; 3]), &[state([1.0; 3], 1.0), bad], false).is_err());
    assert!(resolve_text_protection(envelope, Some([0.0; 3]), &[state([1.0; 3], 0.0)], false).is_err());
    for (surface, states) in [
        (None, vec![state([1.0; 3], 1.0)]),
        (Some([0.0; 3]), vec![]),
        (Some([0.0; 3]), vec![state([f64::NAN; 3], 1.0)]),
    ] {
        let result = resolve_text_protection(envelope, surface, &states, false).unwrap();
        assert_eq!(result.alpha, 1.0);
        assert!(!result.verified);
    }
}

#[test]
fn shared_normal_recipes_support_both_scheme_envelopes_without_mutation() {
    let cases: Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/theme-backdrop-recipe.json")).unwrap();
    for case in cases.as_array().unwrap().iter().take(6) {
        let before = case["input"].clone();
        for (scheme, surface, text) in [("dark", [0.0; 3], [1.0; 3]), ("light", [1.0; 3], [0.0; 3])] {
            let envelope = ColorEnvelope::from_recipe(&before, scheme, SHADOW).unwrap();
            assert!(resolve_text_protection(envelope, Some(surface), &[state(text, 1.0)], false).unwrap().verified);
        }
        assert_eq!(before, case["input"]);
    }
}
