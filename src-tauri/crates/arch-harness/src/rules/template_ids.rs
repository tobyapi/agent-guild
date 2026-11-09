//! エージェントに「種別」はない。振る舞いは本人の設定で分岐し、テンプレートの ID（"worker" など）は作成時の
//! プリセットの表（guild-domain の agent/templates.rs）の中でだけ使う。ID は表の `id:` フィールドから読み、
//! 同じ文字列のリテラルを本体と各クレートの src から探す。テストのコード（#[cfg(test)]・#[test]・tests/ の
//! ディレクトリと tests.rs のファイル・crates/*/tests）は対象外。

use std::fs;
use std::path::Path;

use crate::files;
use crate::literals::{self, FileLiterals};
use crate::report::Violation;

/// テンプレート表の置き場所
pub const TEMPLATES: &str = "crates/guild-domain/src/agent/templates.rs";

pub fn check(root: &Path) -> Vec<Violation> {
    let ids = match template_ids(root) {
        Ok(ids) => ids,
        Err(violation) => return vec![violation],
    };
    let mut dirs = vec!["src".to_owned()];
    dirs.extend(files::crate_names(root).into_iter().map(|name| format!("crates/{name}/src")));
    let mut violations = Vec::new();
    for file in files::collect(root, &dirs, &[".rs"]) {
        if file.path == TEMPLATES || is_test_file(&file.path) {
            continue;
        }
        match literals::collect(&file.text) {
            Ok(found) => violations.extend(violations_in(&file.path, &found, &ids)),
            Err(error) => violations.push(syntax(&file.path, &error)),
        }
    }
    violations
}

/// テンプレート表に書かれた ID（表が無ければ何も検査しない。表から ID を読めなければ、検査が空振りしないよう違反にする）
fn template_ids(root: &Path) -> Result<Vec<String>, Violation> {
    let Ok(text) = fs::read_to_string(root.join(TEMPLATES)) else {
        return Ok(Vec::new());
    };
    let ids = literals::collect(&text).map(|found| found.id_fields).map_err(|error| syntax(TEMPLATES, &error))?;
    if ids.is_empty() {
        let advice = "テンプレート表から ID（`id: \"…\"` のフィールド）を読めません。ID は文字列リテラルで書く";
        return Err(Violation::new(TEMPLATES, 1, "template-table", advice));
    }
    Ok(ids)
}

fn violations_in(path: &str, found: &FileLiterals, ids: &[String]) -> Vec<Violation> {
    found
        .literals
        .iter()
        .filter(|literal| !literal.in_test && ids.contains(&literal.value))
        .map(|literal| {
            let advice = format!(
                "テンプレートの ID \"{}\" で振る舞いを分岐しない。振る舞いはエージェントの設定（permissions・unmentioned・\
                 consultable・canDelegate・autonomyEnabled）で決め、ID と accent は {TEMPLATES} の表の中だけで使う",
                literal.value
            );
            Violation::new(path, literal.line, "template-id-literal", advice)
        })
        .collect()
}

/// `#[cfg(test)] mod tests;` で読み込まれるファイル（tests/ のディレクトリの中か tests.rs）
fn is_test_file(path: &str) -> bool {
    path.split('/').any(|segment| segment == "tests") || path.ends_with("/tests.rs")
}

fn syntax(path: &str, error: &syn::Error) -> Violation {
    let advice = format!("構文解析できません（{error}）。コンパイルが通る形に直す");
    Violation::new(path, error.span().start().line, "syntax", advice)
}
