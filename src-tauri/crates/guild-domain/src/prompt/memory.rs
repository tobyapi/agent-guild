//! 作業場所と MEMORY.md（次回以降の自分へのメモ）。書き込めるバックエンドでは、ファイルの書き込みを許していなくても
//! 作業場所の MEMORY.md は読み書きしてよい。書き込めないバックエンドには、メモの内容だけを渡す。
//! 作業場所の外にも書ける（writeAnywhere）なら、外のファイルの扱い方も添える。

use super::PromptContext;
use crate::agent::Permissions;

/// MEMORY.md のうちプロンプトに入れる末尾の文字数
pub const MEMORY_TAIL_CHARS: usize = 4000;

/// 作業場所の外にも書ける（writeAnywhere）ときの注意
const OUTSIDE_WORKSPACE: &str = "作業場所の外（このパソコンのほかの場所）のファイルも読み書きできます。外のファイルは頼まれた範囲だけを変え、メモや下書きは作業場所に置いてください。\n";

/// ファイルを書けないエージェントへ: MEMORY.md だけは例外
const MEMORY_ONLY: &str = "## メモ
作業場所の MEMORY.md だけは例外として、いつでも読み書きしてかまいません。MEMORY.md は次回以降のあなた自身が読むメモです。覚えておきたいこと（人間の好み、進行中の作業、学んだこと）は MEMORY.md に追記してください。古くなったメモは消してかまいません。
MEMORY.md 以外のファイルは、「できること」にあるとおりにしてください（書き込みを許されていないファイルは作ったり書き換えたりしない）。
";

pub(super) fn section(ctx: &PromptContext<'_>) -> String {
    let permissions = &ctx.permissions;
    let can_write = ctx
        .backends
        .iter()
        .find(|backend| backend.id == ctx.agent.backend)
        .is_none_or(|backend| backend.capabilities.write_files);
    let mut text = if permissions.write_files {
        workspace_note(permissions)
    } else if can_write {
        MEMORY_ONLY.to_owned()
    } else {
        String::new()
    };
    let memory = tail(ctx.memory.trim(), MEMORY_TAIL_CHARS);
    if !memory.is_empty() {
        text.push_str(&format!("\n### MEMORY.md の現在の内容（末尾）\n{memory}\n"));
    }
    text
}

/// 書き込めるエージェント: 作業場所に置き、MEMORY.md には自分で追記する
fn workspace_note(permissions: &Permissions) -> String {
    let mut text = "## 作業場所とメモ
あなたの作業場所（カレントディレクトリ）には自由にファイルを置けます。MEMORY.md は次回以降のあなた自身が読むメモです。覚えておきたいこと（人間の好み、進行中の作業、学んだこと）は MEMORY.md に追記してください。
"
    .to_owned();
    if permissions.write_anywhere {
        text.push_str(OUTSIDE_WORKSPACE);
    } else if permissions.read_files && permissions.read_anywhere {
        text.push_str(
            "作業場所の外のファイルも読めます。ファイルの作成・編集・削除は作業場所の中だけで行ってください。\n",
        );
    }
    text
}

fn tail(text: &str, max_chars: usize) -> String {
    let count = text.chars().count();
    text.chars().skip(count.saturating_sub(max_chars)).collect()
}
