//! SKILL.md の読み取り（純粋関数）: 先頭の `---` で囲まれた frontmatter の name・description と本文。
//! Agent Skills 標準に合わないところは problem に理由を入れる（一覧には出すが、追加・実行はしない）。

use super::frontmatter::read_fields;
use super::{normalize_skill_description, validate_skill_name, SKILL_DESCRIPTION_MAX_CHARS};

/// スキルのフォルダに置くファイルの名前
pub const SKILL_FILE: &str = "SKILL.md";

const NO_FRONTMATTER: &str = "先頭に frontmatter（--- で囲んだ name と description）がありません。";
const UNCLOSED_FRONTMATTER: &str = "frontmatter が --- で閉じられていません。";
const NO_NAME: &str = "name がありません。";
const BAD_NAME: &str = "name が Agent Skills の形式（英小文字・数字・ハイフン）ではありません。";
const NO_DESCRIPTION: &str = "description がありません。";

/// SKILL.md を読んだ結果
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillFile {
    /// frontmatter の name（なければフォルダ名）
    pub name: String,
    /// 前後の空白を除いた description（なければ空）
    pub description: String,
    /// frontmatter より後ろ（先頭の空行は除く）
    pub body: String,
    /// 標準に合わない理由（合っていれば None）。複数あればつなげる
    pub problem: Option<String>,
}

/// SKILL.md の中身を読む。folder_name は name がないときの表示名
pub fn parse_skill_file(text: &str, folder_name: &str) -> SkillFile {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text).replace("\r\n", "\n");
    match split(&text) {
        Split::Missing => without_frontmatter(&text, folder_name, NO_FRONTMATTER),
        Split::Unclosed => without_frontmatter(&text, folder_name, UNCLOSED_FRONTMATTER),
        Split::Found { yaml, body } => {
            let fields = read_fields(yaml);
            let mut problems = String::new();
            let name = match fields.name.filter(|name| !name.is_empty()) {
                Some(name) => {
                    if validate_skill_name(&name).is_err() {
                        problems.push_str(BAD_NAME);
                    }
                    name
                }
                None => {
                    problems.push_str(NO_NAME);
                    folder_name.to_owned()
                }
            };
            let description = fields.description.unwrap_or_default().trim().to_owned();
            if let Err(problem) = describe(&description) {
                problems.push_str(&problem);
            }
            SkillFile { name, description, body: trim_body(body), problem: Some(problems).filter(|p| !p.is_empty()) }
        }
    }
}

fn describe(description: &str) -> Result<(), String> {
    if description.is_empty() {
        return Err(NO_DESCRIPTION.to_owned());
    }
    normalize_skill_description(description)
        .map(drop)
        .map_err(|_| format!("description が{SKILL_DESCRIPTION_MAX_CHARS}文字を超えています。"))
}

fn without_frontmatter(text: &str, folder_name: &str, problem: &str) -> SkillFile {
    SkillFile {
        name: folder_name.to_owned(),
        description: String::new(),
        body: trim_body(text),
        problem: Some(problem.to_owned()),
    }
}

fn trim_body(body: &str) -> String {
    body.trim_start_matches('\n').to_owned()
}

enum Split<'a> {
    Missing,
    Unclosed,
    Found { yaml: &'a str, body: &'a str },
}

/// 1行目が `---` なら、次の `---` の行までを frontmatter とする
fn split(text: &str) -> Split<'_> {
    let mut lines = text.split_inclusive('\n');
    let first = lines.next().unwrap_or_default();
    if first.trim_end() != "---" {
        return Split::Missing;
    }
    let start = first.len();
    let mut offset = start;
    for line in lines {
        if line.trim_end() == "---" {
            return Split::Found { yaml: &text[start..offset], body: &text[offset + line.len()..] };
        }
        offset += line.len();
    }
    Split::Unclosed
}
