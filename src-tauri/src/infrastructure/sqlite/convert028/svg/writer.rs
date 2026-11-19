//! 字句（tokens.rs）を順に受け取り、許可した要素と属性だけで SVG を書き直す。

use std::fmt::Write as _;

use super::{policy, tokens::Token, SvgProblem};
use super::{DEFAULT_VIEWBOX, FRAME_SVG_MAX_BYTES, MAX_DEPTH, MAX_ELEMENTS, MAX_VALUE_CHARS, SVG_NAMESPACE};

struct OpenElement {
    name: String,
    /// 書き出した（許可した要素で、祖先も落としていない）
    kept: bool,
}

#[derive(Default)]
pub(super) struct Writer {
    out: String,
    open: Vec<OpenElement>,
    elements: usize,
    shapes: usize,
    root_closed: bool,
}

impl Writer {
    pub(super) fn accept(&mut self, token: Token<'_>) -> Result<(), SvgProblem> {
        match token {
            Token::Open { name, attrs, self_closing } => self.open_element(name, &attrs, self_closing),
            Token::Close(name) => self.close_element(name),
            // 文字は描かない（枠に文字は使わない）
            Token::Text(_) => Ok(()),
        }
    }

    pub(super) fn finish(self) -> Result<String, SvgProblem> {
        if !self.root_closed || !self.open.is_empty() {
            return Err(SvgProblem::Malformed);
        }
        if self.shapes == 0 {
            return Err(SvgProblem::Empty);
        }
        if self.out.len() > FRAME_SVG_MAX_BYTES {
            return Err(SvgProblem::TooLarge);
        }
        Ok(self.out)
    }

    fn open_element(&mut self, name: &str, attrs: &[(&str, String)], self_closing: bool) -> Result<(), SvgProblem> {
        if policy::is_forbidden_element(name) {
            return Err(SvgProblem::Forbidden(name.to_owned()));
        }
        check_attributes(attrs)?;
        if self.root_closed {
            return Err(SvgProblem::Malformed);
        }
        self.elements += 1;
        if self.elements > MAX_ELEMENTS || self.open.len() >= MAX_DEPTH {
            return Err(SvgProblem::TooLarge);
        }
        let is_root = self.open.is_empty();
        if is_root && name != "svg" {
            return Err(SvgProblem::Malformed);
        }
        let kept = self.open.iter().all(|element| element.kept) && policy::is_allowed_element(name);
        if kept {
            self.write_open(name, attrs, is_root, self_closing);
            self.shapes += usize::from(policy::is_shape(name));
        }
        if !self_closing {
            self.open.push(OpenElement { name: name.to_owned(), kept });
        } else if is_root {
            self.root_closed = true;
        }
        Ok(())
    }

    fn close_element(&mut self, name: &str) -> Result<(), SvgProblem> {
        let element = self.open.pop().ok_or(SvgProblem::Malformed)?;
        if element.name != name {
            return Err(SvgProblem::Malformed);
        }
        if element.kept {
            let _ = write!(self.out, "</{name}>");
        }
        self.root_closed = self.open.is_empty();
        Ok(())
    }

    fn write_open(&mut self, name: &str, attrs: &[(&str, String)], is_root: bool, self_closing: bool) {
        let _ = write!(self.out, "<{name}");
        if is_root {
            let view_box = attrs
                .iter()
                .find(|(attr, value)| *attr == "viewBox" && is_view_box(value))
                .map_or(DEFAULT_VIEWBOX, |(_, value)| value.as_str());
            let _ = write!(self.out, " xmlns=\"{SVG_NAMESPACE}\" viewBox=\"{}\"", escape(view_box.trim()));
        }
        for (attr, value) in attrs {
            // 根の大きさと位置は画面が決める（viewBox は上で書いた）
            if is_root && matches!(*attr, "viewBox" | "width" | "height" | "x" | "y") {
                continue;
            }
            let written = if policy::is_reference_attribute(attr) {
                "href"
            } else if policy::is_allowed_attribute(attr) {
                attr
            } else {
                continue;
            };
            let _ = write!(self.out, " {written}=\"{}\"", escape(value.trim()));
        }
        self.out.push_str(if self_closing { "/>" } else { ">" });
    }
}

fn check_attributes(attrs: &[(&str, String)]) -> Result<(), SvgProblem> {
    for (name, value) in attrs {
        if policy::is_event_attribute(name) {
            return Err(SvgProblem::EventAttribute((*name).to_owned()));
        }
        if value.chars().count() > MAX_VALUE_CHARS {
            return Err(SvgProblem::TooLarge);
        }
        let safe = if policy::is_reference_attribute(name) {
            policy::is_local_reference(value.trim())
        } else {
            // 名前空間の宣言は書き出さない（根には自分で書く）ので、値は見ない
            name.starts_with("xmlns") || policy::is_safe_value(value)
        };
        if !safe {
            return Err(SvgProblem::ExternalReference);
        }
    }
    Ok(())
}

/// 4つの数で、幅と高さが正
fn is_view_box(value: &str) -> bool {
    let numbers: Option<Vec<f64>> = value
        .split(|c: char| c.is_whitespace() || c == ',')
        .filter(|part| !part.is_empty())
        .map(|part| part.parse::<f64>().ok().filter(|n| n.is_finite()))
        .collect();
    matches!(numbers.as_deref(), Some([_, _, width, height]) if *width > 0.0 && *height > 0.0)
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(c),
        }
    }
    out
}
