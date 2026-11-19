//! SVG（XML）の小さな字句解析。開き・閉じタグと文字だけを取り出し、属性の値の文字参照を戻す。
//! DOCTYPE・CDATA（実体の定義や隠した中身）は受け付けない。コメントと処理命令は読み飛ばす。

use super::SvgProblem;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum Token<'a> {
    Open { name: &'a str, attrs: Vec<(&'a str, String)>, self_closing: bool },
    Close(&'a str),
    Text(&'a str),
}

pub(super) fn tokenize(src: &str) -> Result<Vec<Token<'_>>, SvgProblem> {
    let mut tokens = Vec::new();
    let mut rest = src;
    while !rest.is_empty() {
        if let Some(after) = rest.strip_prefix("<!--") {
            rest = skip_past(after, "-->")?;
        } else if let Some(after) = rest.strip_prefix("<?") {
            rest = skip_past(after, "?>")?;
        } else if rest.starts_with("<!") {
            return Err(SvgProblem::Forbidden("<!".to_owned()));
        } else if let Some(after) = rest.strip_prefix("</") {
            let end = after.find('>').ok_or(SvgProblem::Malformed)?;
            tokens.push(Token::Close(after[..end].trim()));
            rest = &after[end + 1..];
        } else if let Some(after) = rest.strip_prefix('<') {
            let (token, next) = open_tag(after)?;
            tokens.push(token);
            rest = next;
        } else {
            let end = rest.find('<').unwrap_or(rest.len());
            tokens.push(Token::Text(&rest[..end]));
            rest = &rest[end..];
        }
    }
    Ok(tokens)
}

fn skip_past<'a>(src: &'a str, end: &str) -> Result<&'a str, SvgProblem> {
    src.find(end).map(|at| &src[at + end.len()..]).ok_or(SvgProblem::Malformed)
}

fn is_name_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '_' | ':' | '-' | '.')
}

fn name(src: &str) -> Result<(&str, &str), SvgProblem> {
    let end = src.find(|c: char| !is_name_char(c)).unwrap_or(src.len());
    if end == 0 || !src.starts_with(|c: char| c.is_ascii_alphabetic() || c == '_') {
        return Err(SvgProblem::Malformed);
    }
    Ok((&src[..end], &src[end..]))
}

/// `<` の直後から、タグの終わり（`>` か `/>`）まで
fn open_tag(src: &str) -> Result<(Token<'_>, &str), SvgProblem> {
    let (tag, mut rest) = name(src)?;
    let mut attrs = Vec::new();
    loop {
        let trimmed = rest.trim_start();
        let spaced = trimmed.len() < rest.len();
        if let Some(after) = trimmed.strip_prefix("/>") {
            return Ok((Token::Open { name: tag, attrs, self_closing: true }, after));
        }
        if let Some(after) = trimmed.strip_prefix('>') {
            return Ok((Token::Open { name: tag, attrs, self_closing: false }, after));
        }
        if !spaced {
            return Err(SvgProblem::Malformed);
        }
        let (attr, after) = name(trimmed)?;
        let after = after.trim_start().strip_prefix('=').ok_or(SvgProblem::Malformed)?.trim_start();
        let quote = after.chars().next().filter(|c| *c == '"' || *c == '\'').ok_or(SvgProblem::Malformed)?;
        let body = &after[1..];
        let end = body.find(quote).ok_or(SvgProblem::Malformed)?;
        attrs.push((attr, decode(&body[..end])?));
        rest = &body[end + 1..];
    }
}

/// 文字参照（定義済みの5つと数値）を戻す。それ以外の & は誤り
fn decode(raw: &str) -> Result<String, SvgProblem> {
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(at) = rest.find('&') {
        out.push_str(&rest[..at]);
        let after = &rest[at + 1..];
        let end = after.find(';').ok_or(SvgProblem::Malformed)?;
        out.push(entity(&after[..end])?);
        rest = &after[end + 1..];
    }
    if rest.contains('<') {
        return Err(SvgProblem::Malformed);
    }
    out.push_str(rest);
    Ok(out)
}

fn entity(name: &str) -> Result<char, SvgProblem> {
    let code = match name {
        "amp" => return Ok('&'),
        "lt" => return Ok('<'),
        "gt" => return Ok('>'),
        "quot" => return Ok('"'),
        "apos" => return Ok('\''),
        _ => match name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
            Some(hex) => u32::from_str_radix(hex, 16).ok(),
            None => name.strip_prefix('#').and_then(|dec| dec.parse::<u32>().ok()),
        },
    };
    code.and_then(char::from_u32).filter(|c| *c != '\0').ok_or(SvgProblem::Malformed)
}
