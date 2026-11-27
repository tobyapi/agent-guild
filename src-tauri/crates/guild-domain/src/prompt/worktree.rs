//! git worktree（作業用フォルダ）の置き場のルール。ファイルを書け、作業場所の外にも書け（writeAnywhere）、コマンドを
//! 実行できるエージェントにだけ伝える。それ以外には何も出さない（コマンドは作業場所の外に書けず、元のリポジトリの
//! .git/worktrees にも書く git worktree add は成り立たないため）。
//! 前提: 今の役割表とバックエンドでは、writeAnywhere があればコマンドも作業場所の外に書ける（Claude は隔離なしの Bash、
//! Codex は full-access。Ollama は Windows で writeAnywhere を申告しない）。この前提が崩れたら出し分けを見直す。

use std::path::Path;

use crate::agent::Permissions;

/// 置き場の中のフォルダ名の形
const FOLDER_NAME: &str = "<リポジトリ名>-<作業名>";

/// 置き場を決めたあとの共通のルール
const COMMON: &str = "リポジトリの横や中には作らないでください。タスクの終わりに、変更がすべてコミット済みで取り込み先にマージ済みなら git worktree remove で片付けて報告してください。迷ったら人間に確認し、--force は使わないでください。ブランチの削除と、ほかのAIや人間の worktree に触れることは、人間の許可を得てから行ってください。\n";

/// 置き場のルールを伝える相手か（操作の確認に渡す依頼 intent.rs も同じ条件を使う）
pub(super) fn applies(permissions: &Permissions, worktree_home: &str) -> bool {
    permissions.write_files && permissions.write_anywhere && permissions.run_commands && !worktree_home.is_empty()
}

/// worktree_home は実際に使う置き場（絶対パス）
pub(super) fn note(permissions: &Permissions, worktree_home: &str) -> String {
    if !applies(permissions, worktree_home) {
        return String::new();
    }
    let place = Path::new(worktree_home).join(FOLDER_NAME);
    format!("git worktree を作るときは {} に作ってください。{COMMON}", place.display())
}

/// 操作の確認に渡す依頼に添える1行（伝える相手でなければ None）。値は利用者自身の設定なので、確かめる側に渡してよい
pub(super) fn intent_line(permissions: &Permissions, worktree_home: &str) -> Option<String> {
    applies(permissions, worktree_home).then(|| {
        format!("git worktree の置き場（利用者が設定で決めた場所）: {worktree_home}。作業用フォルダはここに作り、終わったら片付けるようアプリが指示している")
    })
}
