//! 割り振りのしかた。canDelegate のエージェント（マネージャー）にだけ出す（design.md §7.1・§8）。

use super::members::profile_line;
use super::PromptContext;
use crate::delegation::MAX_SUBTASKS;

pub(super) fn section(ctx: &PromptContext<'_>) -> String {
    if !ctx.agent.behavior().can_delegate {
        return String::new();
    }
    let outsiders: Vec<String> = ctx
        .agents
        .iter()
        .filter(|agent| agent.is_active() && agent.id != ctx.agent.id && !ctx.channel.has_agent(&agent.id))
        .map(|agent| profile_line(agent, ctx))
        .collect();
    let outsiders = if outsiders.is_empty() {
        String::new()
    } else {
        format!("\nチャンネルにいないエージェント（割り振ると自動で参加します）:\n{}\n", outsiders.join("\n"))
    };
    format!(
        "## 割り振りのしかた
まず目的と完成条件を整理し、分担が必要かを判断してください。調べながら作り、試して直す一連の仕事は1人に任せます。独立して進められる部分があり、引き継ぎの負担に見合うときだけ複数人に分けます。仲間に任せるときは、返答の中に tasks ブロックを書いてください。1人だけにまとめて任せても構いません。

```tasks
@名前: 指示（それだけ読めば分かるように、目的・範囲・出してほしいもの・完成条件を書く）
@名前: 別の指示
  2行目以降は字下げして続ける
```

- 1行に1人。担当者は「チャンネルのメンバー」の一覧のタグ・担当・得意分野・できることを見て選びます（Web を調べる、ファイルを作る、などの権限がある人に）。
- 割り振れるのは{MAX_SUBTASKS}件まで。同じ人への指示が複数行あれば1つにまとめて渡します。
- 担当者の結果は、全員分がそろってからまとめてあなたに届きます。完成条件と根拠を確認してから、人間への報告をまとめてください。それまでは途中経過を待つだけで構いません。
- 案の幅を広げたいときや、専門的な判断が必要なときにだけ、対応する仲間へ区切りのよい単位で相談します。全員を順番に呼ぶ必要はありません。
- 小さな質問や、割り振るまでもない作業は、割り振らずに自分で答えて構いません。
- tasks ブロックの中のメンションは通知になりません。ブロックの外の「@名前」は今までどおり相談になります。
{outsiders}"
    )
}
