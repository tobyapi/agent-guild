//! Recipe input validation. Passing the JSON gate does not establish recipe safety.

mod catalog;
mod checks;
mod cost;
mod envelope;
mod json;
mod protection;
mod structure;

pub use cost::{validate_recipe_cost, DrawingCost, LayerExpansion, PatternRepeat};
pub use envelope::ColorEnvelope;
pub use json::parse_recipe_json;
pub use protection::{resolve_text_protection, Protection, Rgba, TextState};
pub use structure::validate_recipe_structure;

/// App-owned diagnostics only; never include input values or key names.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct RecipeValidationError {
    pub field: String,
    pub code: &'static str,
}

impl RecipeValidationError {
    fn at(field: impl Into<String>, code: &'static str) -> Self {
        Self { field: field.into(), code }
    }

    fn root(code: &'static str) -> Self {
        Self::at("$", code)
    }
}
