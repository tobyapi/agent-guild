use guild_domain::theme_backdrop::{validate_recipe_cost, DrawingCost, LayerExpansion, PatternRepeat};
use serde_json::{json, Value};

use super::theme_backdrop_structure::recipe;

fn expansion(cost: DrawingCost) -> LayerExpansion {
    LayerExpansion { cost, patterns: vec![] }
}

#[test]
fn invalid_expansion_and_overflow_cannot_bypass_budgets() {
    for viewport in [[0.0, 1.0], [-1.0, 1.0], [f64::NAN, 1.0], [f64::INFINITY, 1.0]] {
        assert_eq!(
            validate_recipe_cost(&recipe(), viewport, DrawingCost::default(), &[]).unwrap_err().code,
            "invalid_expansion"
        );
    }
    for period in [0.0, -1.0, f64::NAN, f64::INFINITY] {
        let layer = LayerExpansion {
            cost: DrawingCost::default(),
            patterns: vec![PatternRepeat { width: period, height: 1.0, primitives: 1 }],
        };
        assert_eq!(
            validate_recipe_cost(&recipe(), [1.0; 2], DrawingCost::default(), &[layer]).unwrap_err().code,
            "invalid_expansion"
        );
    }
    let layer = LayerExpansion {
        cost: DrawingCost::default(),
        patterns: vec![PatternRepeat { width: f64::MIN_POSITIVE, height: f64::MIN_POSITIVE, primitives: u64::MAX }],
    };
    assert_eq!(
        validate_recipe_cost(&recipe(), [1920.0, 1080.0], DrawingCost::default(), &[layer]).unwrap_err().code,
        "primitive_budget_exceeded"
    );
}

#[test]
fn shared_six_recipes_and_twelve_diagnostics_survive_cost_gate() {
    let cases: Value =
        serde_json::from_str(include_str!("../../../../../contracts/behavior/theme-backdrop-recipe.json")).unwrap();
    for case in cases.as_array().unwrap() {
        let value = &case["input"];
        // Synthetic expansion tests the gate; it is not a claim about future SVG component counts.
        let layers = value["layers"]
            .as_array()
            .unwrap()
            .iter()
            .map(|layer| {
                expansion(DrawingCost {
                    primitives: 1,
                    dom: 1,
                    definitions: 0,
                    moving_groups: u64::from(layer["motion"] != "none"),
                })
            })
            .collect::<Vec<_>>();
        let result = validate_recipe_cost(value, [1920.0, 1080.0], DrawingCost::default(), &layers);
        let errors = result.err().into_iter().collect::<Vec<_>>();
        assert_eq!(serde_json::to_value(errors).unwrap(), case["expected"]["validationErrors"], "{}", case["name"]);
        assert_eq!(value, &case["input"]);
    }
    let mut moving = recipe();
    moving["layers"][0]["kind"] = json!("paper");
    moving["layers"][0]["motion"] = json!("drift");
    assert_eq!(
        validate_recipe_cost(&moving, [1.0; 2], DrawingCost::default(), &[expansion(DrawingCost::default())])
            .unwrap_err()
            .code,
        "invalid_expansion"
    );
}
