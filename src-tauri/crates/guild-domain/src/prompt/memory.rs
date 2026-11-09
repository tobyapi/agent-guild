//! 作業場所と MEMORY.md（次回以降の自分へのメモ）。書き込める（writeFiles）エージェントにだけ出す。
//! 作業場所の外にも書ける（writeAnywhere）なら、外のファイルの扱い方も添える。

use crate::agent::Permissions;

/// MEMORY.md のうちプロンプトに入れる末尾の文字数
pub const MEMORY_TAIL_CHARS: usize = 4000;

/// 作業場所の外にも書ける（writeAnywhere）ときの注意
const OUTSIDE_WORKSPACE: &str = "作業場所の外（このパソコンのほかの場所）のファイルも読み書きできます。外のファイルは頼まれた範囲だけを変え、メモや下書きは作業場所に置いてください。\n";

pub(super) fn section(memory: &str, permissions: &Permissions) -> String {
    if !permissions.write_files {
        return String::new();
    }
    let mut text = "## 作業場所とメモ
あなたの作業場所（カレントディレクトリ）には自由にファイルを置けます。MEMORY.md は次回以降のあなた自身が読むメモです。覚えておきたいこと（人間の好み、進行中の作業、学んだこと）は MEMORY.md に追記してください。
"
    .to_owned();
    if permissions.write_anywhere {
        text.push_str(OUTSIDE_WORKSPACE);
    }
    let memory = tail(memory.trim(), MEMORY_TAIL_CHARS);
    if !memory.is_empty() {
        text.push_str(&format!("\n### MEMORY.md の現在の内容（末尾）\n{memory}\n"));
    }
    text
}

fn tail(text: &str, max_chars: usize) -> String {
    let count = text.chars().count();
    text.chars().skip(count.saturating_sub(max_chars)).collect()
}
