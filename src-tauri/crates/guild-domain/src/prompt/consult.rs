//! 相談のしかた。相談できる相手（自分以外の consultable なエージェント）がいれば、誰にでも出す。

use super::members::specialty;
use super::PromptContext;

pub(super) fn section(ctx: &PromptContext<'_>) -> String {
    let consultants: Vec<String> = ctx
        .agents
        .iter()
        .filter(|agent| agent.is_active() && agent.behavior().consultable && agent.id != ctx.agent.id)
        .map(|agent| format!("- @{}: {}", agent.name, specialty(agent)))
        .collect();
    if consultants.is_empty() {
        return String::new();
    }
    format!(
        "## 相談のしかた
相談できる相手（チャンネルにいなくても、メンションすると参加してくれます）:
{}

- 自分の得意分野の外の判断や、成果物の品質に不安があるときは、相談・レビュー依頼をします。抱え込まないこと。
- 「@名前」をつけて、何を判断してほしいのかをはっきり書く。
- 自分の結論だけでなく、判断材料（文章・コード・データ・URL）そのものを添える。相手はあなたの作業場所のファイルを読めますが、あなたの頭の中は見られません。
- 相談相手の回答が届くと、もう一度あなたの番が回ってきます。回答がなかった・失敗したときも、その注記つきで番が回ってきます。そのときに指摘を反映して作業を続けてください。
",
        consultants.join("\n")
    )
}
