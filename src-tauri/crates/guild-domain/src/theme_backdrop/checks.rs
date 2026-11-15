use serde_json::{Map, Value};

use super::RecipeValidationError as Error;

pub(super) fn object<'a>(value: &'a Value, field: &str, keys: &[&str]) -> Result<&'a Map<String, Value>, Error> {
    let object = value.as_object().ok_or_else(|| Error::at(field, "invalid_type"))?;
    if object.keys().any(|key| !keys.contains(&key.as_str())) {
        return Err(Error::at(field, "additional_property"));
    }
    for key in keys {
        if !object.contains_key(*key) {
            let path = if field == "$" { (*key).to_owned() } else { format!("{field}.{key}") };
            return Err(Error::at(path, "required"));
        }
    }
    Ok(object)
}

pub(super) fn array<'a>(value: &'a Value, field: &str) -> Result<&'a Vec<Value>, Error> {
    value.as_array().ok_or_else(|| Error::at(field, "invalid_type"))
}

pub(super) fn text<'a>(value: &'a Value, field: &str) -> Result<&'a str, Error> {
    value.as_str().ok_or_else(|| Error::at(field, "invalid_type"))
}

pub(super) fn number(value: &Value, field: &str, min: f64, max: f64, integer: bool) -> Result<f64, Error> {
    let number = value.as_f64().ok_or_else(|| Error::at(field, "invalid_type"))?;
    if !number.is_finite() || (integer && number.fract() != 0.0) {
        return Err(Error::at(field, "invalid_type"));
    }
    if !(min..=max).contains(&number) {
        return Err(Error::at(field, "out_of_range"));
    }
    Ok(number)
}

pub(super) fn choice(value: &Value, field: &str, choices: &[&str], code: &'static str) -> Result<(), Error> {
    if !choices.contains(&text(value, field)?) {
        return Err(Error::at(field, code));
    }
    Ok(())
}
