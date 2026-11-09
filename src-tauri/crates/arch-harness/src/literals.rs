//! syn で構文解析し、ファイルの中の文字列リテラル（式・パターン・マクロの中身）と、構造体のフィールド `id:` に
//! 書かれた文字列リテラルを集める。コメントは構文木に現れないので、誤検出しない。

use proc_macro2::{TokenStream, TokenTree};
use syn::parse::Parser;
use syn::punctuated::Punctuated;
use syn::visit::{self, Visit};
use syn::{Attribute, Expr, LitStr, Member, Token};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StringLiteral {
    pub value: String,
    pub line: usize,
    /// #[cfg(test)] のモジュールや #[test] 関数の中か
    pub in_test: bool,
}

#[derive(Debug, Default)]
pub struct FileLiterals {
    pub literals: Vec<StringLiteral>,
    /// `id: ...` のフィールドの値に書かれた文字列（テンプレート表の ID を読むのに使う）
    pub id_fields: Vec<String>,
}

pub fn collect(text: &str) -> syn::Result<FileLiterals> {
    let file = syn::parse_file(text)?;
    let mut collector = Collector::default();
    collector.visit_file(&file);
    Ok(collector.found)
}

#[derive(Default)]
struct Collector {
    found: FileLiterals,
    test_depth: usize,
    id_depth: usize,
}

impl Collector {
    fn push(&mut self, literal: &LitStr) {
        let value = literal.value();
        if self.id_depth > 0 {
            self.found.id_fields.push(value.clone());
        }
        let line = literal.span().start().line;
        self.found.literals.push(StringLiteral { value, line, in_test: self.test_depth > 0 });
    }

    fn within_test(&mut self, is_test: bool, visit_children: impl FnOnce(&mut Self)) {
        self.test_depth += usize::from(is_test);
        visit_children(self);
        self.test_depth -= usize::from(is_test);
    }
}

impl<'ast> Visit<'ast> for Collector {
    fn visit_lit_str(&mut self, literal: &'ast LitStr) {
        self.push(literal);
    }

    /// マクロの中身は構文解析されない。カンマ区切りの式（vec![…]・format!(…) など）として読めればその式を、
    /// 読めなければトークン列の文字列リテラルを拾う
    fn visit_macro(&mut self, mac: &'ast syn::Macro) {
        match Punctuated::<Expr, Token![,]>::parse_terminated.parse2(mac.tokens.clone()) {
            Ok(exprs) => exprs.iter().for_each(|expr| self.visit_expr(expr)),
            Err(_) => token_literals(mac.tokens.clone()).iter().for_each(|literal| self.push(literal)),
        }
        visit::visit_macro(self, mac);
    }

    fn visit_field_value(&mut self, field: &'ast syn::FieldValue) {
        let is_id = matches!(&field.member, Member::Named(name) if name == "id");
        self.id_depth += usize::from(is_id);
        visit::visit_field_value(self, field);
        self.id_depth -= usize::from(is_id);
    }

    fn visit_item_mod(&mut self, item: &'ast syn::ItemMod) {
        self.within_test(has_cfg_test(&item.attrs), |collector| visit::visit_item_mod(collector, item));
    }

    fn visit_item_fn(&mut self, item: &'ast syn::ItemFn) {
        let is_test = item.attrs.iter().any(|attr| attr.path().segments.last().is_some_and(|s| s.ident == "test"));
        self.within_test(is_test, |collector| visit::visit_item_fn(collector, item));
    }
}

/// トークン列（グループの中も）にある文字列リテラル
fn token_literals(tokens: TokenStream) -> Vec<LitStr> {
    let mut found = Vec::new();
    for tree in tokens {
        match tree {
            TokenTree::Group(group) => found.extend(token_literals(group.stream())),
            TokenTree::Literal(literal) => {
                if let Ok(parsed) = syn::parse_str::<LitStr>(&literal.to_string()) {
                    found.push(LitStr::new(&parsed.value(), literal.span()));
                }
            }
            _ => {}
        }
    }
    found
}

fn has_cfg_test(attrs: &[Attribute]) -> bool {
    attrs
        .iter()
        .any(|attr| attr.path().is_ident("cfg") && attr.parse_args::<syn::Ident>().is_ok_and(|ident| ident == "test"))
}
