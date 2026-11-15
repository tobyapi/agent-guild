use std::{collections::HashSet, fmt};

use serde::de::{self, DeserializeSeed, MapAccess, SeqAccess, Visitor};
use serde_json::Value;

use super::RecipeValidationError;

const MAX_BYTES: usize = 32 * 1024;
const MAX_DEPTH: usize = 8;

/// Check raw JSON before Value can discard duplicate keys. Schema validation follows separately.
pub fn parse_recipe_json(input: &str) -> Result<Value, RecipeValidationError> {
    if input.len() > MAX_BYTES {
        return Err(RecipeValidationError::root("input_too_large"));
    }
    let mut rejection = None;
    let mut deserializer = serde_json::Deserializer::from_str(input);
    let result = JsonGate { depth: 0, rejection: &mut rejection }.deserialize(&mut deserializer);
    if result.is_err() || deserializer.end().is_err() {
        return Err(RecipeValidationError::root(rejection.unwrap_or("invalid_json")));
    }
    serde_json::from_str(input).map_err(|_| RecipeValidationError::root("invalid_json"))
}

struct JsonGate<'a> {
    depth: usize,
    rejection: &'a mut Option<&'static str>,
}

impl JsonGate<'_> {
    fn enter<E: de::Error>(&mut self) -> Result<(), E> {
        self.depth += 1;
        if self.depth > MAX_DEPTH {
            return self.reject("nesting_too_deep");
        }
        Ok(())
    }

    fn reject<E: de::Error>(&mut self, code: &'static str) -> Result<(), E> {
        *self.rejection = Some(code);
        Err(E::custom("Recipe JSON rejected"))
    }

    fn child(&mut self) -> JsonGate<'_> {
        JsonGate { depth: self.depth, rejection: self.rejection }
    }
}

impl<'de> DeserializeSeed<'de> for JsonGate<'_> {
    type Value = ();

    fn deserialize<D: de::Deserializer<'de>>(self, deserializer: D) -> Result<(), D::Error> {
        deserializer.deserialize_any(self)
    }
}

impl<'de> Visitor<'de> for JsonGate<'_> {
    type Value = ();

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("JSON value")
    }

    fn visit_map<A: MapAccess<'de>>(mut self, mut map: A) -> Result<(), A::Error> {
        self.enter()?;
        let mut keys = HashSet::new();
        while let Some(key) = map.next_key::<String>()? {
            if !keys.insert(key) {
                return self.reject("duplicate_key");
            }
            map.next_value_seed(self.child())?;
        }
        Ok(())
    }

    fn visit_seq<A: SeqAccess<'de>>(mut self, mut seq: A) -> Result<(), A::Error> {
        self.enter()?;
        while seq.next_element_seed(self.child())?.is_some() {}
        Ok(())
    }

    fn visit_bool<E: de::Error>(self, _: bool) -> Result<(), E> {
        Ok(())
    }

    fn visit_i64<E: de::Error>(self, _: i64) -> Result<(), E> {
        Ok(())
    }

    fn visit_u64<E: de::Error>(self, _: u64) -> Result<(), E> {
        Ok(())
    }

    fn visit_f64<E: de::Error>(self, _: f64) -> Result<(), E> {
        Ok(())
    }

    fn visit_str<E: de::Error>(self, _: &str) -> Result<(), E> {
        Ok(())
    }

    fn visit_unit<E: de::Error>(self) -> Result<(), E> {
        Ok(())
    }
}
