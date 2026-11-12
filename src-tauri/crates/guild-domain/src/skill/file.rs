//! SKILL.md の読み取り（純粋関数）: 先頭の `---` で囲まれた frontmatter の name・description と本文。
//! Agent Skills 標準に合わないところは problem に理由を入れる（一覧には出すが、追加・実行はしない）。

use super::frontmatter::read_fields;
use super::{normalize_skill_description, validate_skill_name, SKILL_DESCRIPTION_MAX_CHARS};
use crate::locale;

/// スキルのフォルダに置くファイルの名前
pub const SKILL_FILE: &str = "SKILL.md";

fn no_frontmatter() -> &'static str {
    locale::pick([
        "先頭に frontmatter（--- で囲んだ name と description）がありません。",
        "There is no frontmatter (name and description enclosed in ---) at the top.",
        "开头没有 frontmatter（用 --- 包围的 name 和 description）。",
        "開頭沒有 frontmatter（以 --- 包圍的 name 和 description）。",
        "맨 앞에 frontmatter(---로 감싼 name과 description)가 없습니다.",
    ])
}

fn unclosed_frontmatter() -> &'static str {
    locale::pick([
        "frontmatter が --- で閉じられていません。",
        "The frontmatter is not closed with ---.",
        "frontmatter 没有用 --- 结束。",
        "frontmatter 沒有以 --- 結束。",
        "frontmatter가 ---로 닫혀 있지 않습니다.",
    ])
}

fn no_name() -> &'static str {
    locale::pick(["name がありません。", "name is missing.", "缺少 name。", "缺少 name。", "name이 없습니다."])
}

fn bad_name() -> &'static str {
    locale::pick([
        "name が Agent Skills の形式（英小文字・数字・ハイフン）ではありません。",
        "name does not follow the Agent Skills format (lowercase letters, digits, and hyphens).",
        "name 不符合 Agent Skills 的格式（小写英文字母、数字、连字符）。",
        "name 不符合 Agent Skills 的格式（小寫英文字母、數字、連字號）。",
        "name이 Agent Skills 형식(영문 소문자, 숫자, 하이픈)이 아닙니다.",
    ])
}

fn no_description() -> &'static str {
    locale::pick([
        "description がありません。",
        "description is missing.",
        "缺少 description。",
        "缺少 description。",
        "description이 없습니다.",
    ])
}

fn description_too_long() -> String {
    let max = SKILL_DESCRIPTION_MAX_CHARS;
    locale::pick([
        format!("description が{max}文字を超えています。"),
        format!("description is longer than {max} characters."),
        format!("description 超过了 {max} 个字符。"),
        format!("description 超過了 {max} 個字元。"),
        format!("description이 {max}자를 넘습니다."),
    ])
}

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
        Split::Missing => without_frontmatter(&text, folder_name, no_frontmatter()),
        Split::Unclosed => without_frontmatter(&text, folder_name, unclosed_frontmatter()),
        Split::Found { yaml, body } => {
            let fields = read_fields(yaml);
            let mut problems = String::new();
            let name = match fields.name.filter(|name| !name.is_empty()) {
                Some(name) => {
                    if validate_skill_name(&name).is_err() {
                        problems.push_str(bad_name());
                    }
                    name
                }
                None => {
                    problems.push_str(no_name());
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
        return Err(no_description().to_owned());
    }
    normalize_skill_description(description).map(drop).map_err(|_| description_too_long())
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
