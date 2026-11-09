//! 本体クレートの中の依存の向き: interface は infrastructure・bootstrap を、infrastructure は interface・bootstrap を
//! 参照しない（use・式・型・マクロの中の crate:: / super:: のパスを見る）。
//! guild-domain ← guild-application ← 本体 の向きはクレートの依存でコンパイラが強制する。

use std::path::Path;

use crate::module_path;
use crate::report::Violation;

struct LayerRule {
    layer: &'static str,
    forbidden: &'static [&'static str],
    advice: &'static str,
}

const RULES: [LayerRule; 2] = [
    LayerRule {
        layer: "interface",
        forbidden: &["infrastructure", "bootstrap"],
        advice:
            "interface は guild-application のサービス（AppServices）経由で処理を呼び、組み立ては bootstrap に任せる",
    },
    LayerRule {
        layer: "infrastructure",
        forbidden: &["interface", "bootstrap"],
        advice: "infrastructure は guild-application のポートを実装するだけにし、組み立ては bootstrap に任せる",
    },
];

pub fn check(root: &Path) -> Vec<Violation> {
    let (parsed, mut violations) = super::main_crate(root);
    for (file, found) in &parsed {
        let Some(rule) = RULES.iter().find(|rule| super::is_under(&file.path, &[&format!("src/{}", rule.layer)]))
        else {
            continue;
        };
        let module = super::module_of(file);
        for reference in &found.references {
            let path = module_path::resolve(&reference.segments, &module);
            if let Some(target) = forbidden_layer(&path, rule.forbidden) {
                let advice = format!("{} は crate::{target} を参照しない。{}", rule.layer, rule.advice);
                violations.push(Violation::new(&file.path, reference.line, "layer-dependency", advice));
            }
        }
    }
    violations
}

/// crate::<layer> で始まり、その layer が禁止されているなら layer
fn forbidden_layer(path: &[String], forbidden: &[&'static str]) -> Option<&'static str> {
    if path.first().map(String::as_str) != Some("crate") {
        return None;
    }
    let layer = path.get(1)?;
    forbidden.iter().copied().find(|forbidden| forbidden == layer)
}
