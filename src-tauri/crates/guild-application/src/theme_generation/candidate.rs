use serde_json::{Map, Value};

pub(super) fn valid(text: &str) -> bool {
    // Bound both bytes and the UTF-16 length used by the frontend.
    text.len() <= 32768 && text.encode_utf16().count() <= 8192 && serde_json::from_str(text).is_ok_and(candidate)
}

fn object<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Map<String, Value>> {
    value.as_object().filter(|map| map.len() == keys.len() && keys.iter().all(|key| map.contains_key(*key)))
}

fn candidate(value: Value) -> bool {
    let Some(theme) = object(&value, &["schemaVersion", "name", "variants", "corners", "typeStyle", "background"])
    else {
        return false;
    };
    theme["schemaVersion"].as_f64() == Some(2.0)
        && short_text(&theme["name"], 40)
        && matches!(theme["corners"].as_str(), Some("square" | "standard" | "soft"))
        && matches!(theme["typeStyle"].as_str(), Some("system" | "serifHeadings"))
        && object(&theme["variants"], &["dark", "light"]).is_some_and(|variants| variants.values().all(palette))
        && object(&theme["background"], &["kind", "description"])
            .is_some_and(|bg| bg["kind"] == "generate" && short_text(&bg["description"], 200))
}

fn palette(value: &Value) -> bool {
    object(value, &["surface", "text", "muted", "accent", "divider"]).is_some_and(|colors| {
        ["surface", "text", "muted", "accent"].iter().all(|key| hex(&colors[*key])) && divider(&colors["divider"])
    })
}

fn divider(value: &Value) -> bool {
    let Some(line) = object(value, &["color", "style", "width"]) else { return false };
    if !hex(&line["color"]) {
        return false;
    }
    match line["style"].as_str() {
        Some("solid" | "dashed") => matches!(line["width"].as_f64(), Some(1.0 | 2.0 | 3.0)),
        Some("double") => line["width"].as_f64() == Some(3.0),
        Some("none") => line["width"].as_f64() == Some(0.0),
        _ => false,
    }
}

fn hex(value: &Value) -> bool {
    value.as_str().is_some_and(|color| {
        let bytes = color.as_bytes();
        bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit)
    })
}

fn short_text(value: &Value, limit: usize) -> bool {
    value.as_str().is_some_and(|text| {
        // ECMAScript String.trim includes the BOM and excludes NEXT LINE.
        let clean = text.trim_matches(|c: char| (c.is_whitespace() && c != '\u{85}') || c == '\u{feff}');
        !clean.is_empty() && clean.chars().count() <= limit
    })
}
