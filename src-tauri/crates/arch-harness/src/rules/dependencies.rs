//! guild-domain・guild-application の Cargo.toml の依存は architecture.md の許可リストの範囲だけ。
//! [dependencies]・[build-dependencies]（target 別も）を見る。[dev-dependencies] はテスト専用なので見ない。
//! tokio は使ってよい機能（features）も限る（workspace = true なら [workspace.dependencies] の機能も数える）。

use std::fs;
use std::path::Path;

use toml::{Table, Value};

use crate::report::Violation;

struct Allowlist {
    krate: &'static str,
    crates: &'static [&'static str],
    features: &'static [(&'static str, &'static [&'static str])],
}

const ALLOWLISTS: [Allowlist; 2] = [
    Allowlist { krate: "guild-domain", crates: &["serde", "serde_json", "unicode-normalization"], features: &[] },
    Allowlist {
        krate: "guild-application",
        crates: &["guild-domain", "async-trait", "tokio", "parking_lot", "log", "thiserror", "serde_json"],
        features: &[("tokio", &["sync", "time", "rt", "macros"])],
    },
];
const SECTIONS: [&str; 2] = ["dependencies", "build-dependencies"];

pub fn check(root: &Path) -> Vec<Violation> {
    let workspace = fs::read_to_string(root.join("Cargo.toml")).ok().and_then(|text| text.parse::<Table>().ok());
    ALLOWLISTS.iter().flat_map(|allowlist| check_crate(root, allowlist, workspace.as_ref())).collect()
}

fn check_crate(root: &Path, allowlist: &Allowlist, workspace: Option<&Table>) -> Vec<Violation> {
    let file = format!("crates/{}/Cargo.toml", allowlist.krate);
    // まだ作られていないクレートは検査しない
    let Ok(text) = fs::read_to_string(root.join(&file)) else {
        return Vec::new();
    };
    let manifest = match text.parse::<Table>() {
        Ok(manifest) => manifest,
        Err(error) => return vec![Violation::new(&file, 1, "manifest", format!("Cargo.toml を読めません（{error}）"))],
    };
    let dependency = |(key, spec): (&String, &Value)| check_dependency(&file, &text, key, spec, allowlist, workspace);
    dependency_tables(&manifest).into_iter().flat_map(|table| table.iter().filter_map(dependency)).collect()
}

fn dependency_tables(manifest: &Table) -> Vec<&Table> {
    let mut tables = sections_of(manifest);
    let targets = manifest.get("target").and_then(Value::as_table).into_iter().flat_map(|targets| targets.values());
    for target in targets.filter_map(Value::as_table) {
        tables.extend(sections_of(target));
    }
    tables
}

fn sections_of(table: &Table) -> Vec<&Table> {
    SECTIONS.iter().filter_map(|section| table.get(*section).and_then(Value::as_table)).collect()
}

fn check_dependency(
    file: &str,
    text: &str,
    key: &str,
    spec: &Value,
    allowlist: &Allowlist,
    workspace: Option<&Table>,
) -> Option<Violation> {
    let name = spec.get("package").and_then(Value::as_str).unwrap_or(key);
    let line = line_of(text, key);
    if !allowlist.crates.contains(&name) {
        let advice = format!(
            "{} は {name} に依存しない（許可: {}）。外界との接点はポートにして本体の infrastructure で実装する",
            allowlist.krate,
            allowlist.crates.join(", ")
        );
        return Some(Violation::new(file, line, "inner-crate-dependency", advice));
    }
    let (_, allowed) = allowlist.features.iter().find(|(krate, _)| *krate == name)?;
    let extra: Vec<String> = features_of(key, spec, workspace).into_iter().filter(|f| !allowed.contains(&f.as_str())).collect();
    let advice = format!("{name} の機能 {} は使わない（許可: {}）", extra.join(", "), allowed.join(", "));
    (!extra.is_empty()).then(|| Violation::new(file, line, "inner-crate-feature", advice))
}

fn features_of(key: &str, spec: &Value, workspace: Option<&Table>) -> Vec<String> {
    let strings = |value: Option<&Value>| -> Vec<String> {
        value.and_then(Value::as_array).into_iter().flatten().filter_map(Value::as_str).map(str::to_owned).collect()
    };
    let inherited = if spec.get("workspace").and_then(Value::as_bool) == Some(true) {
        let shared = workspace.and_then(|table| table.get("workspace")?.get("dependencies")?.get(key));
        strings(shared.and_then(|dependency| dependency.get("features")))
    } else {
        Vec::new()
    };
    [inherited, strings(spec.get("features"))].concat()
}

/// key = … が書かれた行（見つからなければ 1）
fn line_of(text: &str, key: &str) -> usize {
    let starts_entry = |line: &str| line.trim_start().strip_prefix(key).is_some_and(|rest| rest.trim_start().starts_with(['=', '.']));
    text.lines().position(starts_entry).map_or(1, |index| index + 1)
}
