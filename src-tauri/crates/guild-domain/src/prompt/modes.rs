//! モード別の指示: reply（呼びかけ・相談）・return（相談の結果）・autonomous（自由時間）・task（割り振られたタスク）。
//! report（まとめ）は report.rs。

use super::conversation::{quote, ConsultSource};
use super::members::name_of;
use super::{report, PromptContext};
use crate::conversation::{JobMode, JobSpec};

pub(super) fn instruction(ctx: &PromptContext<'_>, job: &JobSpec, sources: &[ConsultSource]) -> String {
    match job.mode {
        JobMode::Reply => reply(ctx, job, sources),
        JobMode::Return => returned(ctx, job),
        JobMode::Autonomous => autonomous(ctx),
        JobMode::Task => task(ctx, job),
        JobMode::Report => report::instruction(ctx),
    }
}

fn reply(ctx: &PromptContext<'_>, job: &JobSpec, sources: &[ConsultSource]) -> String {
    let mut text =
        format!("# あなたの番です\n上の「あなた宛ての未対応の発言」に、{} として返答してください。", ctx.agent.name);
    if job.return_to.is_empty() {
        return text;
    }
    let callers: Vec<&str> = job
        .return_to
        .iter()
        .filter_map(|id| ctx.agents.iter().find(|agent| &agent.id == id))
        .map(|agent| agent.name.as_str())
        .collect();
    text.push_str(&format!(
        "\nこれは {} からの相談です。あなたの返答は自動で相手に届くので、返事のためのメンションは要りません。",
        callers.join("・")
    ));
    for source in sources {
        text.push_str(&format!("\n{} の作業場所（読み取りのみ）: {}", source.name, source.path));
    }
    text
}

fn returned(ctx: &PromptContext<'_>, job: &JobSpec) -> String {
    let mut text = "# 相談の結果が届きました
上の「あなた宛ての未対応の発言」と注記は、あなたが相談した相手からの返答（または返答がなかったこと）です。
この結果を踏まえて、元の作業を続けてください。指摘を反映した修正版を出す、人間に結果を報告する、などです。
さらに確認が必要なら、もう一度メンションして相談しても構いません。"
        .to_owned();
    if let Some((manager, instruction)) = assignment(ctx, job) {
        text.push_str(&format!(
            "\nこれは {manager} から割り振られた次のタスクの続きです。終わったら結果をこのチャンネルに報告してください。\n{}",
            quote(instruction)
        ));
    }
    text
}

fn task(ctx: &PromptContext<'_>, job: &JobSpec) -> String {
    let Some((manager, instruction)) = assignment(ctx, job) else {
        return reply(ctx, job, &[]);
    };
    format!(
        "# あなたの番です（割り振られたタスク）
{manager} から割り振られたタスクです:
{}

- 終わったら、結果をこのチャンネルに報告してください。あなたの返答は、ほかの担当者の結果とまとめて {manager} に届きます。
- 成果物を作ったら、ファイル名と場所も書いてください。
- できない・情報が足りないときは、その旨と理由を報告してください。
- 必要なら、相談できる相手にメンションして相談しても構いません（回答が届くと、もう一度あなたの番が回ってきます）。",
        quote(instruction)
    )
}

/// このジョブが担当者として進めるサブタスクの、割り振ったマネージャーの名前と指示
fn assignment<'a>(ctx: &PromptContext<'a>, job: &JobSpec) -> Option<(String, &'a str)> {
    let target = job.subtask.as_ref().filter(|target| target.assignee_id == ctx.agent.id)?;
    let delegation = ctx.delegation.filter(|delegation| delegation.id == target.delegation_id)?;
    let subtask = delegation.subtask(&target.subtask_id)?;
    Some((name_of(ctx, &delegation.manager_id), subtask.instruction.as_str()))
}

fn autonomous(ctx: &PromptContext<'_>) -> String {
    let permissions = &ctx.permissions;
    let mut ideas = Vec::new();
    if permissions.web_search || permissions.web_fetch {
        ideas.push("- Webで最近の話題やニュースを調べて、面白いものをチャンネルで紹介する");
    }
    ideas.push("- チャンネルの最近の発言から、役に立ちそうなアイデアや下調べを出す");
    if permissions.write_files {
        ideas.push("- 作業場所にメモや下書きを作り、その進捗を共有する");
    }
    ideas.push("- 作ったものに自信がなければ、相談できる相手にレビューを頼む");
    format!(
        "# 自由時間の過ごし方
いまは自由時間です。誰からも話しかけられていません。
あなたの役割と興味に沿って、自分で何かをしてください。たとえば:
{}

チャンネルの最近の発言と同じ話題の繰り返しは避けてください。共有する価値のあるものがなければ [PASS] とだけ出力してください。",
        ideas.join("\n")
    )
}
