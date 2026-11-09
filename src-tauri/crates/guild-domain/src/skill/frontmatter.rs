//! frontmatter（YAML）から name と description だけを読む小さな読み取り器。
//! 最上位のキーの文字列（プレーン・"…"・'…'・| と > のブロック）に対応し、ほかのキーと入れ子は読み飛ばす。

/// frontmatter から読んだ項目（キーがなければ None）
#[derive(Debug, Default)]
pub(super) struct Fields {
    pub name: Option<String>,
    pub description: Option<String>,
}

pub(super) fn read_fields(yaml: &str) -> Fields {
    let lines: Vec<&str> = yaml.lines().collect();
    let mut fields = Fields::default();
    let mut index = 0;
    while index < lines.len() {
        let Some((key, inline)) = top_level_key(lines[index]) else {
            index += 1;
            continue;
        };
        let end = continuation_end(&lines, index + 1);
        let value = || scalar(inline, &lines[index + 1..end]);
        match key {
            "name" => fields.name = Some(value()),
            "description" => fields.description = Some(value()),
            _ => {}
        }
        index = end;
    }
    fields
}

/// 字下げのない `key: value` の行
fn top_level_key(line: &str) -> Option<(&str, &str)> {
    if line.starts_with([' ', '\t', '#']) {
        return None;
    }
    let (key, rest) = line.split_once(':')?;
    if !(rest.is_empty() || rest.starts_with([' ', '\t'])) {
        return None;
    }
    Some((key.trim().trim_matches(['"', '\'']), rest.trim()))
}

/// 字下げされた行と空行は、直前のキーの値の続き
fn continuation_end(lines: &[&str], from: usize) -> usize {
    let mut end = from;
    while end < lines.len() && (is_blank(lines[end]) || lines[end].starts_with([' ', '\t'])) {
        end += 1;
    }
    end
}

fn scalar(inline: &str, rest: &[&str]) -> String {
    let value = match inline.chars().next() {
        Some('|') if is_block_header(inline) => block(rest).join("\n"),
        Some('>') if is_block_header(inline) => fold(&block(rest)),
        Some('"') => double_quoted(&fold(&flow_lines(inline, rest))),
        Some('\'') => single_quoted(&fold(&flow_lines(inline, rest))),
        _ => plain(&fold(&flow_lines(inline, rest).into_iter().map(strip_comment).collect::<Vec<_>>())),
    };
    value.trim().to_owned()
}

/// `|`・`>-`・`|2+` など（後ろにコメントがあってもよい）
fn is_block_header(inline: &str) -> bool {
    let indicators = strip_comment(&inline[1..]);
    indicators.chars().all(|c| matches!(c, '+' | '-' | '0'..='9'))
}

/// ブロックの行から共通の字下げを除く（空行は空文字）
fn block<'a>(rest: &[&'a str]) -> Vec<&'a str> {
    let indent = rest.iter().filter(|line| !is_blank(line)).map(|line| indent_of(line)).min().unwrap_or(0);
    rest.iter().map(|line| if is_blank(line) { "" } else { &line[indent..] }).collect()
}

/// 続きの行を前後の空白を除いて並べる（空行は空文字）
fn flow_lines<'a>(inline: &'a str, rest: &[&'a str]) -> Vec<&'a str> {
    std::iter::once(inline).chain(rest.iter().map(|line| line.trim_matches([' ', '\t']))).collect()
}

/// 行を空白でつなぎ、空行は改行にする（YAML の折り返し）
fn fold(lines: &[&str]) -> String {
    let mut out = String::new();
    let mut after_break = true;
    for line in lines {
        if line.is_empty() {
            out.push('\n');
            after_break = true;
            continue;
        }
        if !after_break {
            out.push(' ');
        }
        out.push_str(line);
        after_break = false;
    }
    out
}

fn plain(value: &str) -> String {
    match value.trim() {
        "~" | "null" | "Null" | "NULL" => String::new(),
        value => value.to_owned(),
    }
}

/// "…"（エスケープを解く。閉じていなければ最後までを値とする）
fn double_quoted(value: &str) -> String {
    let mut out = String::new();
    let mut chars = value.chars().skip(1);
    while let Some(c) = chars.next() {
        match c {
            '"' => break,
            '\\' => match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some(other) => out.push(other),
                None => break,
            },
            c => out.push(c),
        }
    }
    out
}

/// '…'（'' は ' の1文字）
fn single_quoted(value: &str) -> String {
    let mut out = String::new();
    let mut chars = value.chars().skip(1).peekable();
    while let Some(c) = chars.next() {
        if c != '\'' {
            out.push(c);
        } else if chars.next_if_eq(&'\'').is_some() {
            out.push('\'');
        } else {
            break;
        }
    }
    out
}

/// プレーンな値の後ろのコメント（空白に続く #）を除く
fn strip_comment(value: &str) -> &str {
    let cut = value.find(" #").or_else(|| value.find("\t#")).unwrap_or(value.len());
    let value = &value[..cut];
    if value.starts_with('#') {
        ""
    } else {
        value
    }
}

fn is_blank(line: &str) -> bool {
    line.trim_matches([' ', '\t']).is_empty()
}

fn indent_of(line: &str) -> usize {
    line.len() - line.trim_start_matches([' ', '\t']).len()
}
