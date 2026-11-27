//! git worktree（作業用フォルダ）の置き場のルール。ファイルを書けてコマンドを実行できるエージェントにだけ伝える。
//! 作業場所の外にも書ける（writeAnywhere）なら設定の置き場、書けなければ自分の作業場所の中に作る。

use std::path::Path;

use crate::agent::Permissions;

/// 置き場の中のフォルダ名の形
const FOLDER_NAME: &str = "<リポジトリ名>-<作業名>";

/// 置き場を決めたあとの共通のルール
const COMMON: &str = "リポジトリの横や中には作らないでください。タスクの終わりに、変更がすべてコミット済みで取り込み先にマージ済みなら git worktree remove で片付けて報告してください。迷ったら人間に確認し、--force は使わないでください。ブランチの削除と、ほかのAIや人間の worktree に触れることは、人間の許可を得てから行ってください。\n";

/// worktree_home は実際に使う置き場（絶対パス）
pub(super) fn note(permissions: &Permissions, worktree_home: &str) -> String {
    if !permissions.write_files || !permissions.run_commands {
        return String::new();
    }
    let place = if permissions.write_anywhere && !worktree_home.is_empty() {
        format!("{}", Path::new(worktree_home).join(FOLDER_NAME).display())
    } else {
        format!("自分の作業場所の中の {FOLDER_NAME}")
    };
    format!("git worktree を作るときは {place} に作ってください。{COMMON}")
}
