use super::{ColorEnvelope, RecipeValidationError as Error};

#[derive(Debug, Clone, Copy)]
pub struct Rgba {
    pub rgb: [f64; 3],
    pub alpha: f64,
}

/// One resolved text/state pair. Overlays run from the scrim towards the text.
#[derive(Debug, Clone)]
pub struct TextState {
    pub text: Rgba,
    pub overlays: Vec<Rgba>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Protection {
    pub alpha: f64,
    /// False for unresolved tokens; opaque fallback is required but is not a quality pass.
    pub verified: bool,
}

/// Call separately for all six panel/scheme units, and again after any style/viewport change.
/// Missing/invalid tokens force opaque fallback. A resolved opaque surface below 4.5 is rejected.
pub fn resolve_text_protection(
    envelope: ColorEnvelope,
    surface: Option<[f64; 3]>,
    states: &[TextState],
    raster_failed: bool,
) -> Result<Protection, Error> {
    let Some(surface) = surface.filter(|s| valid_rgb(*s)) else {
        return Ok(Protection { alpha: 1.0, verified: false });
    };
    if states.is_empty() || !states.iter().all(valid_state) {
        return Ok(Protection { alpha: 1.0, verified: false });
    }
    if !raster_failed {
        for step in 0..1000 {
            let alpha = f64::from(step) / 1000.0;
            if minimum_contrast(envelope.over(surface, alpha), states) >= 4.6 {
                return Ok(Protection { alpha, verified: true });
            }
        }
    }
    if minimum_contrast(envelope.over(surface, 1.0), states) < 4.5 {
        return Err(Error::root("text_protection_failed"));
    }
    Ok(Protection { alpha: 1.0, verified: true })
}

fn valid_rgb(rgb: [f64; 3]) -> bool {
    rgb.iter().all(|v| v.is_finite() && (0.0..=1.0).contains(v))
}

fn valid_state(state: &TextState) -> bool {
    std::iter::once(&state.text)
        .chain(&state.overlays)
        .all(|c| valid_rgb(c.rgb) && c.alpha.is_finite() && (0.0..=1.0).contains(&c.alpha))
}

fn minimum_contrast(envelope: ColorEnvelope, states: &[TextState]) -> f64 {
    states
        .iter()
        .map(|state| {
            let background = state.overlays.iter().fold(envelope, |box_, c| box_.over(c.rgb, c.alpha));
            let bg = background.luminance_range();
            let fg = background.over(state.text.rgb, state.text.alpha).luminance_range();
            // Independent intervals deliberately overapproximate the correlated foreground/background.
            if fg[0] > bg[1] {
                (fg[0] + 0.05) / (bg[1] + 0.05)
            } else if bg[0] > fg[1] {
                (bg[0] + 0.05) / (fg[1] + 0.05)
            } else {
                1.0
            }
        })
        .fold(f64::INFINITY, f64::min)
}
