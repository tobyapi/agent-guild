//! syn で構文解析し、ファイルが参照するパス（use・式・型・パターン・属性・マクロの中身）と Tauri コマンドの関数を集める。
//! コメントと文字列は構文木に現れないので、誤検出しない。

use proc_macro2::{Span, TokenStream, TokenTree};
use syn::spanned::Spanned;
use syn::visit::{self, Visit};
use syn::{Attribute, UseTree};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Reference {
    pub segments: Vec<String>,
    pub line: usize,
    /// #[cfg(test)] のモジュールや #[test] 関数の中か
    pub in_test: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandFn {
    pub name: String,
    pub line: usize,
    pub is_async: bool,
}

#[derive(Debug, Default)]
pub struct FileReferences {
    pub references: Vec<Reference>,
    pub commands: Vec<CommandFn>,
}

pub fn collect(text: &str) -> syn::Result<FileReferences> {
    let file = syn::parse_file(text)?;
    let mut collector = Collector::default();
    collector.visit_file(&file);
    Ok(collector.found)
}

#[derive(Default)]
struct Collector {
    found: FileReferences,
    test_depth: usize,
}

impl Collector {
    fn push(&mut self, segments: Vec<String>, span: Span) {
        if !segments.is_empty() {
            let reference = Reference { segments, line: span.start().line, in_test: self.test_depth > 0 };
            self.found.references.push(reference);
        }
    }

    fn within(&mut self, is_test: bool, visit_children: impl FnOnce(&mut Self)) {
        self.test_depth += usize::from(is_test);
        visit_children(self);
        self.test_depth -= usize::from(is_test);
    }
}

impl<'ast> Visit<'ast> for Collector {
    fn visit_path(&mut self, path: &'ast syn::Path) {
        let segments = path.segments.iter().map(|segment| segment.ident.to_string()).collect();
        self.push(segments, path.span());
        visit::visit_path(self, path);
    }

    /// use の木は Path としては現れないので、ここで展開する
    fn visit_item_use(&mut self, item: &'ast syn::ItemUse) {
        let mut expanded = Vec::new();
        expand_use(&item.tree, &mut Vec::new(), &mut expanded);
        for (segments, span) in expanded {
            self.push(segments, span);
        }
    }

    fn visit_item_extern_crate(&mut self, item: &'ast syn::ItemExternCrate) {
        self.push(vec![item.ident.to_string()], item.ident.span());
    }

    /// マクロの中身は構文解析されないので、`a::b` の形のトークン列を拾う
    fn visit_macro(&mut self, mac: &'ast syn::Macro) {
        let mut found = Vec::new();
        token_paths(mac.tokens.clone(), &mut found);
        for (segments, span) in found {
            self.push(segments, span);
        }
        visit::visit_macro(self, mac);
    }

    fn visit_item_mod(&mut self, item: &'ast syn::ItemMod) {
        self.within(has_cfg_test(&item.attrs), |collector| visit::visit_item_mod(collector, item));
    }

    fn visit_item_fn(&mut self, item: &'ast syn::ItemFn) {
        if item.attrs.iter().any(is_tauri_command) {
            let name = item.sig.ident.to_string();
            let command =
                CommandFn { name, line: item.sig.ident.span().start().line, is_async: item.sig.asyncness.is_some() };
            self.found.commands.push(command);
        }
        let is_test = item.attrs.iter().any(|attr| attr.path().segments.last().is_some_and(|s| s.ident == "test"));
        self.within(is_test, |collector| visit::visit_item_fn(collector, item));
    }
}

fn expand_use(tree: &UseTree, prefix: &mut Vec<String>, out: &mut Vec<(Vec<String>, Span)>) {
    let with = |prefix: &[String], last: &syn::Ident| [prefix, &[last.to_string()]].concat();
    match tree {
        UseTree::Path(path) => {
            prefix.push(path.ident.to_string());
            expand_use(&path.tree, prefix, out);
            prefix.pop();
        }
        UseTree::Name(name) => out.push((with(prefix, &name.ident), name.ident.span())),
        UseTree::Rename(rename) => out.push((with(prefix, &rename.ident), rename.ident.span())),
        // `use a::b::*` は [a, b, *]（列挙子などの中身を取り込むことが分かるように）
        UseTree::Glob(glob) => out.push(([prefix.as_slice(), &["*".to_owned()]].concat(), glob.span())),
        UseTree::Group(group) => group.items.iter().for_each(|item| expand_use(item, prefix, out)),
    }
}

/// `Ident (:: Ident)+` の並び（2 段以上）を拾う。グループ（括弧の中）にも潜る
fn token_paths(tokens: TokenStream, out: &mut Vec<(Vec<String>, Span)>) {
    let trees: Vec<TokenTree> = tokens.into_iter().collect();
    let mut index = 0;
    while index < trees.len() {
        match &trees[index] {
            TokenTree::Group(group) => token_paths(group.stream(), out),
            TokenTree::Ident(ident) => {
                let mut segments = vec![ident.to_string()];
                while let Some(TokenTree::Ident(next)) = path_separator_then(&trees, index) {
                    segments.push(next.to_string());
                    index += 3;
                }
                if segments.len() > 1 {
                    out.push((segments, ident.span()));
                }
            }
            _ => {}
        }
        index += 1;
    }
}

/// trees[index] の後ろが `::` なら、その次のトークン
fn path_separator_then(trees: &[TokenTree], index: usize) -> Option<&TokenTree> {
    let is_colon = |tree: Option<&TokenTree>| matches!(tree, Some(TokenTree::Punct(punct)) if punct.as_char() == ':');
    (is_colon(trees.get(index + 1)) && is_colon(trees.get(index + 2))).then(|| trees.get(index + 3)).flatten()
}

fn has_cfg_test(attrs: &[Attribute]) -> bool {
    attrs
        .iter()
        .any(|attr| attr.path().is_ident("cfg") && attr.parse_args::<syn::Ident>().is_ok_and(|ident| ident == "test"))
}

/// #[tauri::command] または（tauri::command を use した上での）#[command]
pub fn is_tauri_command(attr: &Attribute) -> bool {
    let segments: Vec<String> = attr.path().segments.iter().map(|segment| segment.ident.to_string()).collect();
    segments == ["tauri", "command"] || segments == ["command"]
}
