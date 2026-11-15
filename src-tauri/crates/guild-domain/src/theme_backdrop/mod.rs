//! Recipe input validation. Passing the JSON gate does not establish recipe safety.

mod json;

pub use json::parse_recipe_json;

/// App-owned diagnostics only; never include input values or key names.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct RecipeValidationError {
    pub field: &'static str,
    pub code: &'static str,
}

impl RecipeValidationError {
    fn root(code: &'static str) -> Self {
        Self { field: "$", code }
    }
}
