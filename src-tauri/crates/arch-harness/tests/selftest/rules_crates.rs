//! クレートをまたぐ規則: テンプレートの ID の置き場所・内側のクレートの依存・行数。

use arch_harness::rules::{dependencies, size, template_ids};

use crate::fixture::{summary, Workspace};

const TEMPLATES: &str = "fn templates() -> Vec<T> {\n    vec![T { id: \"worker\".to_owned(), label: \"作業者\".to_owned() }, T { id: \"expert\".into(), label: \"専門家\".into() }]\n}\nfn lookup() { find(\"worker\") }";

#[test]
fn template_ids_only_in_the_template_table() {
    let workspace = Workspace::new(
        "template-ids",
        &[
            ("crates/guild-domain/src/agent/templates.rs", TEMPLATES),
            (
                "crates/guild-application/src/routing.rs",
                "fn r(a: &A) -> bool {\n    a.tags[0] == \"作業者\" || a.template == \"worker\"\n}",
            ),
            (
                "crates/guild-domain/src/prompt.rs",
                "fn p() -> String {\n    format!(\"{}\", \"expert\")\n}\nconst OK: &str = \"workers\";",
            ),
            (
                "src/bootstrap/seed.rs",
                "fn s() { let id = \"worker\"; }\n#[cfg(test)]\nmod tests { fn t() { let _ = \"expert\"; } }",
            ),
            ("src/bootstrap/tests/seed.rs", "fn t() { input(\"worker\", \"ハル\"); }"),
            ("crates/guild-application/tests/app/support.rs", "fn t() { input(\"expert\"); }"),
        ],
    );
    assert_eq!(
        summary(&template_ids::check(&workspace.root)),
        [
            "crates/guild-application/src/routing.rs:2 template-id-literal",
            "crates/guild-domain/src/prompt.rs:2 template-id-literal",
            "src/bootstrap/seed.rs:1 template-id-literal",
        ]
    );
}

#[test]
fn a_template_table_without_readable_ids_is_reported() {
    let workspace = Workspace::new("template-ids-none", &[("src/seed.rs", "fn s() { let _ = \"worker\"; }")]);
    assert!(template_ids::check(&workspace.root).is_empty(), "表が無ければ検査しない");
    let unreadable = Workspace::new(
        "template-ids-unreadable",
        &[("crates/guild-domain/src/agent/templates.rs", "const IDS: [&str; 1] = [WORKER];")],
    );
    assert_eq!(
        summary(&template_ids::check(&unreadable.root)),
        ["crates/guild-domain/src/agent/templates.rs:1 template-table"]
    );
}

const WORKSPACE_MANIFEST: &str = "[workspace]\nmembers = [\"crates/*\"]\n\n[workspace.dependencies]\ntokio = { version = \"1\", features = [\"sync\", \"process\"] }\nlog = \"0.4\"\n";

#[test]
fn inner_crates_depend_only_on_allowed_crates_and_features() {
    let workspace = Workspace::new("dependencies", &[
        ("Cargo.toml", WORKSPACE_MANIFEST),
        ("crates/guild-domain/Cargo.toml", "[package]\nname = \"guild-domain\"\n\n[dependencies]\nserde = \"1\"\nrusqlite = \"0.41\"\n\n[dev-dependencies]\ntempfile = \"3\"\n"),
        ("crates/guild-application/Cargo.toml", "[package]\nname = \"guild-application\"\n\n[dependencies]\ntokio = { workspace = true, features = [\"time\"] }\nlogging = { package = \"log\", version = \"0.4\" }\n\n[target.'cfg(windows)'.dependencies]\ntauri = \"2\"\n"),
    ]);
    assert_eq!(
        summary(&dependencies::check(&workspace.root)),
        [
            "crates/guild-domain/Cargo.toml:6 inner-crate-dependency",
            "crates/guild-application/Cargo.toml:5 inner-crate-feature",
            "crates/guild-application/Cargo.toml:9 inner-crate-dependency",
        ]
    );
}

#[test]
fn files_must_stay_under_150_non_blank_lines() {
    let long = "let x = 1;\n\n".repeat(200);
    let short = "let x = 1;\n".repeat(199);
    let workspace = Workspace::new(
        "size",
        &[
            ("src/ok.rs", &short),
            ("src/long.rs", &long),
            ("crates/runner-client/tests/fixtures/long.mjs", &long),
            ("crates/runner-client/target/debug/huge.rs", &long),
        ],
    );
    assert_eq!(
        summary(&size::check(&workspace.root)),
        ["crates/runner-client/tests/fixtures/long.mjs:399 max-lines", "src/long.rs:399 max-lines",]
    );
}
