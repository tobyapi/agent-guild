//! tasks ブロックの読み取り（§7.1-1）: 全角・続きの行・同じ担当者の結合・割り振れない名前・8件の上限。

use guild_domain::agent::Agent;
use guild_domain::delegation::{parse_tasks, PlannedTask, TaskPlan, MAX_SUBTASKS};
use guild_domain::ids::AgentId;

use super::support::agent;

fn agents() -> Vec<Agent> {
    let mut ghost = agent("ghost", "worker", "ゴースト");
    ghost.deleted_at = Some(1);
    vec![
        agent("kaname", "manager", "カナメ"),
        agent("haru", "worker", "ハル"),
        agent("haruka", "worker", "ハルカ"),
        agent("sora", "worker", "Sora"),
        ghost,
    ]
}

fn plan(content: &str) -> Option<TaskPlan> {
    parse_tasks(content, &AgentId::new("kaname"), &agents())
}

fn task(assignee: &str, instruction: &str) -> PlannedTask {
    PlannedTask { assignee: AgentId::new(assignee), instruction: instruction.to_owned() }
}

#[test]
fn reads_each_line_with_half_and_full_width_marks() {
    let content =
        "2つに分けます。\n\n```tasks\n@ハル: 競合アプリを3つ調べて\n＠ｓｏｒａ：試作を作って\n```\nよろしく。";
    let plan = plan(content).expect("tasks ブロックがある");
    assert_eq!(plan.tasks, vec![task("haru", "競合アプリを3つ調べて"), task("sora", "試作を作って")]);
    assert!(plan.unassignable.is_empty() && plan.overflow.is_empty());
}

#[test]
fn continuation_lines_and_repeated_assignees_join_with_newlines() {
    let content = "```tasks\n@ハル: 調べて\n  出典もつけて\n\n@Sora: 作って\n@ハル: 表にまとめて\n```";
    let plan = plan(content).expect("tasks ブロックがある");
    assert_eq!(plan.tasks, vec![task("haru", "調べて\n出典もつけて\n表にまとめて"), task("sora", "作って")]);
}

#[test]
fn prefers_the_longest_matching_name() {
    let plan =
        plan("```tasks\n@ハルカ: 下書きを読んで\n@ハル 区切りが空白でもよい\n```").expect("tasks ブロックがある");
    assert_eq!(plan.tasks, vec![task("haruka", "下書きを読んで"), task("haru", "区切りが空白でもよい")]);
}

#[test]
fn unknown_deleted_and_self_are_skipped_and_reported_once() {
    let content = "```tasks\n@だれか: 何か\n  続きも捨てる\n@ゴースト: 何か\n@カナメ: 自分で\n@だれか: もう一度\n@ハル: 本題\n```";
    let plan = plan(content).expect("tasks ブロックがある");
    assert_eq!(plan.tasks, vec![task("haru", "本題")]);
    assert_eq!(plan.unassignable, ["だれか", "ゴースト", "カナメ"]);
}

#[test]
fn keeps_at_most_eight_subtasks() {
    let mut many: Vec<Agent> = (0..10).map(|i| agent(&format!("w{i}"), "worker", &format!("作業者{i}"))).collect();
    many.push(agent("kaname", "manager", "カナメ"));
    let lines: Vec<String> = (0..10).map(|i| format!("@作業者{i}: 仕事{i}")).collect();
    let content = format!("```tasks\n{}\n```", lines.join("\n"));
    let plan = parse_tasks(&content, &AgentId::new("kaname"), &many).expect("tasks ブロックがある");
    assert_eq!(plan.tasks.len(), MAX_SUBTASKS);
    assert_eq!(plan.overflow, ["作業者8", "作業者9"]);
}

#[test]
fn reads_only_the_first_tasks_block_and_skips_other_code_blocks() {
    let content = "```markdown\n```tasks\n@ハル: 例なので読まない\n```\n\n```tasks\n@Sora: 本物\n```\n```tasks\n@ハル: 2つ目は読まない\n```";
    let plan = plan(content).expect("tasks ブロックがある");
    assert_eq!(plan.tasks, vec![task("sora", "本物")]);
}

#[test]
fn without_a_tasks_block_there_is_no_plan() {
    assert_eq!(plan("@ハル: ブロックの外は相談です"), None);
    assert_eq!(plan("```rust\n@ハル: コードの中\n```"), None);
    let empty = plan("```tasks\n説明だけ\n```").expect("ブロックはある");
    assert!(empty.tasks.is_empty() && empty.unassignable.is_empty());
}
