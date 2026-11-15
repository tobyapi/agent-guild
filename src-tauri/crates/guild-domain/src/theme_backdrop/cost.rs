use serde_json::Value;

use super::{validate_recipe_structure, RecipeValidationError as Error};

/// Counts from the app-owned SVG expansion, including definitions and wrappers.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DrawingCost {
    pub primitives: u64,
    pub dom: u64,
    pub definitions: u64,
    pub moving_groups: u64,
}

/// CSS-pixel period and primitive count of one complete pattern cell.
#[derive(Debug, Clone, Copy)]
pub struct PatternRepeat {
    pub width: f64,
    pub height: f64,
    pub primitives: u64,
}

#[derive(Debug, Clone)]
pub struct LayerExpansion {
    pub cost: DrawingCost,
    pub patterns: Vec<PatternRepeat>,
}

/// Expansion metadata is trusted application data, never fields supplied by the model.
/// Use the full viewport, including the motion envelope, in CSS pixels.
pub fn validate_recipe_cost(
    recipe: &Value,
    viewport: [f64; 2],
    base: DrawingCost,
    layers: &[LayerExpansion],
) -> Result<DrawingCost, Error> {
    validate_recipe_structure(recipe)?;
    let recipes = recipe["layers"].as_array().ok_or_else(|| Error::root("invalid_type"))?;
    if layers.len() != recipes.len() || !viewport.iter().all(|v| v.is_finite() && *v > 0.0) {
        return Err(Error::root("invalid_expansion"));
    }
    let mut total = base;
    check_budget(total)?;
    for (layer, expansion) in recipes.iter().zip(layers) {
        if layer["motion"] != "none" && expansion.cost.moving_groups == 0 {
            return Err(Error::root("invalid_expansion"));
        }
        total.primitives = total.primitives.saturating_add(expansion.cost.primitives);
        total.dom = total.dom.saturating_add(expansion.cost.dom);
        total.definitions = total.definitions.saturating_add(expansion.cost.definitions);
        total.moving_groups = total.moving_groups.saturating_add(expansion.cost.moving_groups);
        for pattern in &expansion.patterns {
            total.primitives = total.primitives.saturating_add(pattern_cost(viewport, pattern)?);
        }
        check_budget(total)?;
    }
    Ok(total)
}

fn pattern_cost(viewport: [f64; 2], pattern: &PatternRepeat) -> Result<u64, Error> {
    if ![pattern.width, pattern.height].iter().all(|v| v.is_finite() && *v > 0.0) || pattern.primitives == 0 {
        return Err(Error::root("invalid_expansion"));
    }
    // One extra row/column covers arbitrary phase and partially visible boundary cells.
    let cells = ((viewport[0] / pattern.width).ceil() + 1.0) * ((viewport[1] / pattern.height).ceil() + 1.0);
    Ok((cells as u64).saturating_mul(pattern.primitives))
}

fn check_budget(cost: DrawingCost) -> Result<(), Error> {
    for (value, limit, code) in [
        (cost.primitives, 2000, "primitive_budget_exceeded"),
        (cost.dom, 400, "dom_budget_exceeded"),
        (cost.definitions, 32, "definition_budget_exceeded"),
        (cost.moving_groups, 2, "motion_budget_exceeded"),
    ] {
        if value > limit {
            return Err(Error::at("layers", code));
        }
    }
    Ok(())
}
