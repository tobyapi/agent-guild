use guild_domain::theme_backdrop::{validate_recipe_cost, DrawingCost, LayerExpansion, PatternRepeat};
use serde_json::{json, Value};

use super::theme_backdrop_structure::recipe;

fn expansion(cost: DrawingCost) -> LayerExpansion {
    LayerExpansion { cost, patterns: vec![] }
}

#[test]
fn layer_costs_and_patterns_are_added_to_base_without_resetting_the_budget() {
    let mut value = recipe();
    let second_layer = value["layers"][0].clone();
    value["layers"].as_array_mut().unwrap().push(second_layer);
    let cost = DrawingCost { primitives: 500, dom: 100, definitions: 8, moving_groups: 1 };
    let mut layers = vec![expansion(cost), expansion(cost)];
    layers[0].patterns.push(PatternRepeat { width: 100.0, height: 100.0, primitives: 2 });
    layers[0].patterns.push(PatternRepeat { width: 100.0, height: 100.0, primitives: 3 });
    let base = DrawingCost { primitives: 20, dom: 10, definitions: 1, moving_groups: 0 };
    assert_eq!(
        validate_recipe_cost(&value, [100.0; 2], base, &layers).unwrap(),
        DrawingCost { primitives: 1040, dom: 210, definitions: 17, moving_groups: 2 }
    );
    layers[1].cost.moving_groups = 2;
    assert_eq!(validate_recipe_cost(&value, [100.0; 2], base, &layers).unwrap_err().code, "motion_budget_exceeded");
}

#[test]
fn cost_limits_are_inclusive_and_each_overrun_has_a_fixed_code() {
    let boundary = DrawingCost { primitives: 2000, dom: 400, definitions: 32, moving_groups: 2 };
    assert_eq!(
        validate_recipe_cost(&recipe(), [1920.0, 1080.0], boundary, &[expansion(DrawingCost::default())]),
        Ok(boundary)
    );
    for (cost, code) in [
        (DrawingCost { primitives: 2001, ..boundary }, "primitive_budget_exceeded"),
        (DrawingCost { dom: 401, ..boundary }, "dom_budget_exceeded"),
        (DrawingCost { definitions: 33, ..boundary }, "definition_budget_exceeded"),
        (DrawingCost { moving_groups: 3, ..boundary }, "motion_budget_exceeded"),
    ] {
        let error =
            validate_recipe_cost(&recipe(), [1920.0, 1080.0], DrawingCost::default(), &[expansion(cost)]).unwrap_err();
        assert_eq!((error.field.as_str(), error.code), ("layers", code));
    }
}

#[test]
fn pattern_cost_uses_viewport_area_partial_cells_and_phase_guard() {
    let layer = LayerExpansion {
        cost: DrawingCost { dom: 3, definitions: 1, ..DrawingCost::default() },
        patterns: vec![PatternRepeat { width: 100.0, height: 50.0, primitives: 2 }],
    };
    for (viewport, expected) in [([200.0, 100.0], 18), ([201.0, 101.0], 32), ([400.0, 200.0], 50)] {
        let cost =
            validate_recipe_cost(&recipe(), viewport, DrawingCost::default(), std::slice::from_ref(&layer)).unwrap();
        assert_eq!((cost.primitives, cost.dom, cost.definitions), (expected, 3, 1));
    }
    let error = validate_recipe_cost(&recipe(), [10000.0; 2], DrawingCost::default(), &[layer]).unwrap_err();
    assert_eq!(error.code, "primitive_budget_exceeded");
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
