use serde_json::Value;

use super::{checks::text, RecipeValidationError as Error};

pub(super) fn validate_layer(layer: &Value, index: usize) -> Result<(), Error> {
    let field = format!("layers[{index}]");
    let kind = text(&layer["kind"], &format!("{field}.kind"))?;
    let motifs: &[&str] = match kind {
        "tile" | "symbol" => &["star", "cross", "dot", "wave", "seaweed", "tree", "turtle"],
        "halftone" => &["hill", "cloud", "wave"],
        "paper" => &["hill", "cloud", "wave", "seaweed", "tree", "turtle", "aurora"],
        _ => return Err(Error::at(format!("{field}.kind"), "unsupported_kind")),
    };
    let motif = text(&layer["motif"], &format!("{field}.motif"))?;
    if !motifs.contains(&motif) {
        return Err(Error::at(format!("{field}.motif"), "unsupported_motif"));
    }
    if kind != "paper" && layer["depth"].as_f64() != Some(1.0) {
        return Err(Error::at(format!("{field}.depth"), "invalid_depth"));
    }
    if kind == "paper" && layer["density"].as_f64() != Some(0.5) {
        return Err(Error::at(format!("{field}.density"), "invalid_density"));
    }
    let motion = text(&layer["motion"], &format!("{field}.motion"))?;
    let allowed = match motion {
        "none" => true,
        "drift" => kind == "paper" && ["cloud", "wave", "turtle", "aurora"].contains(&motif),
        "sway" => ["paper", "symbol"].contains(&kind) && ["tree", "seaweed"].contains(&motif),
        _ => false,
    };
    if !allowed {
        return Err(Error::at(format!("{field}.motion"), "unsupported_motion"));
    }
    Ok(())
}
