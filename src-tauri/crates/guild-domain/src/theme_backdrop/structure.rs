use serde_json::Value;

use super::{catalog, checks::*, RecipeValidationError as Error};

const ROOT_KEYS: &[&str] = &["schemaVersion", "catalogVersion", "title", "seed", "palette", "composition", "layers"];
const LAYER_KEYS: &[&str] = &["kind", "motif", "anchor", "color", "scale", "density", "depth", "motion"];

/// Stage 2b only. Call after parse_recipe_json; cost and text protection gates must still follow.
/// Does not modify the input or establish that a recipe is safe to render or save.
pub fn validate_recipe_structure(value: &Value) -> Result<(), Error> {
    let root = object(value, "$", ROOT_KEYS)?;
    version(&root["schemaVersion"], "schemaVersion", "unsupported_version")?;
    version(&root["catalogVersion"], "catalogVersion", "unsupported_catalog")?;
    title(&root["title"])?;
    number(&root["seed"], "seed", 0.0, 4294967295.0, true)?;
    let palette_len = palette(&root["palette"])?;
    choice(&root["composition"], "composition", &["quietCenter"], "unsupported_composition")?;
    let layers = array(&root["layers"], "layers")?;
    if layers.is_empty() {
        return Err(Error::at("layers", "too_few_layers"));
    }
    if layers.len() > 8 {
        return Err(Error::at("layers", "too_many_layers"));
    }
    for (index, layer) in layers.iter().enumerate() {
        layer_structure(layer, index, palette_len)?;
    }
    for (index, layer) in layers.iter().enumerate() {
        catalog::validate_layer(layer, index)?;
    }
    Ok(())
}

fn version(value: &Value, field: &str, code: &'static str) -> Result<(), Error> {
    let number = value.as_f64().ok_or_else(|| Error::at(field, "invalid_type"))?;
    if !number.is_finite() || number.fract() != 0.0 {
        return Err(Error::at(field, "invalid_type"));
    }
    if number != 1.0 {
        return Err(Error::at(field, code));
    }
    Ok(())
}

fn title(value: &Value) -> Result<(), Error> {
    let title = text(value, "title")?;
    if !(1..=40).contains(&title.chars().count()) || title.len() > 160 {
        return Err(Error::at("title", "invalid_title"));
    }
    if title.chars().any(|c| c.is_control() || c == '\u{2028}' || c == '\u{2029}') {
        return Err(Error::at("title", "invalid_title"));
    }
    Ok(())
}

fn palette(value: &Value) -> Result<usize, Error> {
    let palette = object(value, "palette", &["dark", "light"])?;
    for scheme in ["dark", "light"] {
        let field = format!("palette.{scheme}");
        let colors = array(&palette[scheme], &field)?;
        if !(4..=8).contains(&colors.len()) {
            return Err(Error::at(field, "invalid_palette_length"));
        }
        for (index, color) in colors.iter().enumerate() {
            let field = format!("{field}[{index}]");
            let color = text(color, &field)?;
            if color.len() != 7 || !color.starts_with('#') || !color.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit) {
                return Err(Error::at(field, "invalid_color"));
            }
        }
    }
    let dark = array(&palette["dark"], "palette.dark")?;
    let light = array(&palette["light"], "palette.light")?;
    if dark.len() != light.len() {
        return Err(Error::at("palette", "palette_length_mismatch"));
    }
    Ok(dark.len())
}

fn layer_structure(value: &Value, index: usize, palette_len: usize) -> Result<(), Error> {
    let field = format!("layers[{index}]");
    let layer = object(value, &field, LAYER_KEYS)?;
    choice(&layer["kind"], &format!("{field}.kind"), &["tile", "halftone", "paper", "symbol"], "unsupported_kind")?;
    text(&layer["motif"], &format!("{field}.motif"))?;
    choice(
        &layer["anchor"],
        &format!("{field}.anchor"),
        &["left", "right", "bottomLeft", "bottomRight"],
        "unsupported_anchor",
    )?;
    let color_field = format!("{field}.color");
    let color = number(&layer["color"], &color_field, 1.0, 7.0, true)?;
    if color >= palette_len as f64 {
        return Err(Error::at(color_field, "color_out_of_bounds"));
    }
    number(&layer["scale"], &format!("{field}.scale"), 0.25, 1.0, false)?;
    number(&layer["density"], &format!("{field}.density"), 0.0, 1.0, false)?;
    number(&layer["depth"], &format!("{field}.depth"), 1.0, 3.0, true)?;
    choice(&layer["motion"], &format!("{field}.motion"), &["none", "drift", "sway"], "unsupported_motion")?;
    Ok(())
}
