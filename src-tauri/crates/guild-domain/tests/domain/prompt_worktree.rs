//! git worktree の置き場のルール: 作業場所の外にも書け、コマンドを使える AI にだけ置き場を伝える。それ以外には出さない。

use std::path::Path;

use guild_domain::agent::Permissions;
use guild_domain::locale::Language;
use guild_domain::profile::Profile;
use guild_domain::prompt::{build_system_prompt, PromptContext};
use guild_domain::worktree_home::{normalize_worktree_home, WorktreeHome};

use super::support::{agent, channel};

const RULE: &str = "git worktree を作るときは";
const COMMON: [&str; 5] = [
    "リポジトリの横や中には作らないでください。",
    "変更がすべてコミット済みで取り込み先にマージ済みなら git worktree remove で片付けて報告してください。",
    "迷ったら人間に確認し、--force は使わないでください。",
    "ブランチの削除と、ほかのAIや人間の worktree に触れることは、人間の許可を得てから行ってください。",
    "タスクの終わりに",
];

const WORKER: Permissions = Permissions {
    web_search: false,
    web_fetch: false,
    read_files: true,
    read_anywhere: false,
    write_files: true,
    write_anywhere: false,
    run_commands: true,
    skills: false,
};
const ANYWHERE: Permissions = Permissions { read_anywhere: true, write_anywhere: true, ..WORKER };

fn system_prompt(permissions: Permissions, worktree_home: &str) -> String {
    let agents = vec![agent("haru", "worker", "ハル")];
    let lobby = channel("c1", &["me", "haru"]);
    let me = Profile::default();
    let ctx = PromptContext {
        agent: &agents[0],
        permissions,
        channel: &lobby,
        agents: &agents,
        backends: &[],
        me: &me,
        skills: &[],
        memory: "",
        now_label: "",
        time_label: &|_| String::new(),
        attachment_path: &|_, _| String::new(),
        delegation: None,
        language: Language::Ja,
        worktree_home,
    };
    build_system_prompt(&ctx)
}

/// 置き場の行（1行）
fn rule_line(prompt: &str) -> &str {
    let Some(line) = prompt.lines().find(|line| line.starts_with(RULE)) else {
        panic!("置き場のルールがありません:\n{prompt}");
    };
    line
}

fn place(home: &str) -> String {
    Path::new(home).join("<リポジトリ名>-<作業名>").display().to_string()
}

#[test]
fn default_home_is_used_for_agents_that_write_anywhere() {
    let home = WorktreeHome { path: None, default_path: r"D:\agent-guild-data\worktrees".to_owned() };
    let prompt = system_prompt(ANYWHERE, home.effective());
    let line = rule_line(&prompt);
    assert!(
        line.starts_with(&format!("{RULE} {} に作ってください。", place(r"D:\agent-guild-data\worktrees"))),
        "{line}"
    );
    for part in COMMON {
        assert!(line.contains(part), "{part} がありません: {line}");
    }
    let workspace = prompt.find("## 作業場所とメモ").unwrap();
    assert!(workspace < prompt.find(RULE).unwrap(), "作業場所とメモの節に入れる");
}

#[test]
fn a_changed_home_replaces_the_default() {
    let home =
        WorktreeHome { path: Some(r"E:\wt".to_owned()), default_path: r"D:\agent-guild-data\worktrees".to_owned() };
    let prompt = system_prompt(ANYWHERE, home.effective());
    assert!(rule_line(&prompt).contains(&place(r"E:\wt")));
    assert!(!prompt.contains("agent-guild-data"), "既定の置き場は出さない");
}

#[test]
fn agents_that_write_only_in_their_workspace_get_no_rule() {
    // コマンドは作業場所の外に書けず、git worktree add は元のリポジトリの .git にも書くので成り立たない。伝えない
    let prompt = system_prompt(WORKER, r"E:\wt");
    assert!(!prompt.contains("git worktree"), "{prompt}");
    assert!(!prompt.contains(r"E:\wt"), "書けない置き場は伝えない");
}

#[test]
fn agents_that_cannot_run_git_get_no_rule() {
    for permissions in [
        Permissions { run_commands: false, ..ANYWHERE },
        Permissions { write_files: false, write_anywhere: false, ..ANYWHERE },
    ] {
        let prompt = system_prompt(permissions, r"E:\wt");
        assert!(!prompt.contains("git worktree"), "{permissions:?}\n{prompt}");
    }
}

#[test]
fn the_rule_stays_short() {
    let line = rule_line(&system_prompt(ANYWHERE, r"D:\agent-guild-data\worktrees")).to_owned();
    assert!(line.chars().count() < 260, "{} 文字: {line}", line.chars().count());
}

/// 絶対パスの判定は OS ごと（CI とアプリは Windows）
#[cfg(windows)]
#[test]
fn homes_must_be_absolute_and_blank_means_default() {
    assert_eq!(normalize_worktree_home(None), Ok(None));
    assert_eq!(normalize_worktree_home(Some("  ")), Ok(None));
    assert_eq!(normalize_worktree_home(Some(r" D:\wt ")), Ok(Some(r"D:\wt".to_owned())));
    for relative in ["worktrees", r".\wt", r"..\wt", "D:wt"] {
        let error = normalize_worktree_home(Some(relative)).unwrap_err();
        assert_eq!(error.field(), Some("path"), "{relative}");
    }
}
