use serde_json::Value;

use super::{validate_recipe_structure, RecipeValidationError as Error};

/// Trusted application colors used beneath or alongside palette-based drawing.
/// These are expansion metadata, never model-supplied Recipe fields.
#[derive(Debug, Clone, Copy)]
pub struct ColorExpansion {
    pub underlay: Option<[f64; 3]>,
    pub uses_black_shadow: bool,
}

/// Conservative sRGB box containing palette, underlay and declared shadow mixtures.
#[derive(Debug, Clone, Copy)]
pub struct ColorEnvelope {
    pub(crate) low: [f64; 3],
    pub(crate) high: [f64; 3],
}

impl ColorEnvelope {
    pub fn from_recipe(recipe: &Value, scheme: &str, expansion: ColorExpansion) -> Result<Self, Error> {
        validate_recipe_structure(recipe)?;
        if !["dark", "light"].contains(&scheme) {
            return Err(Error::at("palette", "invalid_scheme"));
        }
        let colors = recipe["palette"][scheme].as_array().ok_or_else(|| Error::at("palette", "invalid_type"))?;
        if expansion.underlay.is_some_and(|rgb| !rgb.iter().all(|v| v.is_finite() && (0.0..=1.0).contains(v))) {
            return Err(Error::root("invalid_expansion"));
        }
        let mut low = [1.0_f64; 3];
        let mut high = [0.0_f64; 3];
        for color in colors {
            let text = color.as_str().ok_or_else(|| Error::at("palette", "invalid_color"))?;
            for (channel, maximum) in high.iter_mut().enumerate() {
                let start = 1 + channel * 2;
                let byte = u8::from_str_radix(&text[start..start + 2], 16)
                    .map_err(|_| Error::at("palette", "invalid_color"))?;
                let value = f64::from(byte) / 255.0;
                low[channel] = low[channel].min(value);
                *maximum = maximum.max(value);
            }
        }
        if let Some(underlay) = expansion.underlay {
            for (channel, value) in underlay.into_iter().enumerate() {
                low[channel] = low[channel].min(value);
                high[channel] = high[channel].max(value);
            }
        }
        if expansion.uses_black_shadow {
            low = [0.0; 3];
        }
        Ok(Self { low, high })
    }

    /// Eight corners bound every convex sRGB mixture, not just sampled palette endpoints.
    pub fn corners(self) -> [[f64; 3]; 8] {
        std::array::from_fn(|mask| {
            std::array::from_fn(|c| if mask & (1 << c) == 0 { self.low[c] } else { self.high[c] })
        })
    }

    pub(crate) fn over(self, color: [f64; 3], alpha: f64) -> Self {
        let blend = |bound: [f64; 3]| std::array::from_fn(|i| alpha * color[i] + (1.0 - alpha) * bound[i]);
        Self { low: blend(self.low), high: blend(self.high) }
    }

    pub(crate) fn luminance_range(self) -> [f64; 2] {
        let values = self.corners().map(luminance);
        [values.into_iter().fold(f64::INFINITY, f64::min), values.into_iter().fold(0.0, f64::max)]
    }
}

fn luminance(rgb: [f64; 3]) -> f64 {
    let linear = rgb.map(|c| if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) });
    0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}
