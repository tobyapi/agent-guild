use guild_domain::theme_backdrop::{validate_recipe_structure, RecipeValidationError};
use serde_json::json;

use super::theme_backdrop_structure::recipe;

#[test]
fn every_kind_motif_motion_combination_matches_catalog_one() {
    let motifs = ["star", "cross", "dot", "wave", "seaweed", "tree", "turtle", "hill", "cloud", "aurora", "whale"];
    let mut accepted = 0;
    for kind in ["tile", "halftone", "paper", "symbol", "pixel"] {
        for motif in motifs {
            for motion in ["none", "drift", "sway", "spin"] {
                let mut value = recipe();
                value["layers"][0]["kind"] = json!(kind);
                value["layers"][0]["motif"] = json!(motif);
                value["layers"][0]["motion"] = json!(motion);
                value["layers"][0]["density"] = json!(0.5);
                let known_motif = match kind {
                    "tile" | "symbol" => ["star", "cross", "dot", "wave", "seaweed", "tree", "turtle"].contains(&motif),
                    "halftone" => ["hill", "cloud", "wave"].contains(&motif),
                    "paper" => ["hill", "cloud", "wave", "seaweed", "tree", "turtle", "aurora"].contains(&motif),
                    _ => false,
                };
                let allowed_motion = motion == "none"
                    || (motion == "drift" && kind == "paper" && ["cloud", "wave", "turtle", "aurora"].contains(&motif))
                    || (motion == "sway"
                        && ["paper", "symbol"].contains(&kind)
                        && ["tree", "seaweed"].contains(&motif));
                let expected = if kind == "pixel" {
                    Err(("kind", "unsupported_kind"))
                } else if motion == "spin" {
                    Err(("motion", "unsupported_motion"))
                } else if !known_motif {
                    Err(("motif", "unsupported_motif"))
                } else if !allowed_motion {
                    Err(("motion", "unsupported_motion"))
                } else {
                    accepted += 1;
                    Ok(())
                };
                let expected = expected
                    .map_err(|(field, code)| RecipeValidationError { field: format!("layers[0].{field}"), code });
                assert_eq!(validate_recipe_structure(&value), expected, "{kind}/{motif}/{motion}");
            }
        }
    }
    assert_eq!(accepted, 32);
}

#[test]
fn catalog_diagnostics_preserve_layer_index() {
    let mut value = recipe();
    let layer = value["layers"][0].clone();
    value["layers"].as_array_mut().unwrap().push(layer);
    value["layers"][1]["motif"] = json!("whale");
    assert_eq!(
        validate_recipe_structure(&value),
        Err(RecipeValidationError { field: "layers[1].motif".into(), code: "unsupported_motif" })
    );
}
