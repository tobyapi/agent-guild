//! tasks ブロックの読み取り（§7.1-1）。返答の中の最初の ```tasks ブロックだけを読み、`@名前: 指示` の行を
//! サブタスクにする（全角の ＠・： も可。@ で始まらない行は直前の指示の続き、空行は無視）。
//! 名前はメンションと同じ規則（NFKC＋大文字小文字無視、長い名前から）で引く。

use crate::agent::{name_key, Agent};
use crate::ids::AgentId;

/// 1つの割り振りのサブタスクの上限
pub const MAX_SUBTASKS: usize = 8;

const FENCE: &str = "```";
/// 名前の候補として調べる長さの上限（文字数）。これより長い区切りは名前ではない
const NAME_PROBE_CHARS: usize = 128;

/// 割り振る1件
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedTask {
    pub assignee: AgentId,
    /// 指示（続きの行と、同じ担当者の行は改行でつなぐ）
    pub instruction: String,
}

/// tasks ブロックを読んだ結果
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TaskPlan {
    /// 書かれた順（同じ担当者は最初の位置に1つ）。MAX_SUBTASKS 件まで
    pub tasks: Vec<PlannedTask>,
    /// 割り振れなかった名前（見つからない・削除済み・自分自身）
    pub unassignable: Vec<String>,
    /// 上限を超えたので飛ばした担当者の名前
    pub overflow: Vec<String>,
}

/// author（マネージャー）の返答 content の tasks ブロックを読む。ブロックがなければ None
pub fn parse_tasks(content: &str, author: &AgentId, agents: &[Agent]) -> Option<TaskPlan> {
    let lines = tasks_block(content)?;
    let keys: Vec<(String, &Agent)> = agents
        .iter()
        .filter(|agent| agent.is_active())
        .map(|agent| (name_key(&agent.name), agent))
        .filter(|(key, _)| !key.is_empty())
        .collect();
    let mut plan = TaskPlan::default();
    let mut tasks: Vec<PlannedTask> = Vec::new();
    // 続きの行をつなぐ先（割り振れなかった行の続きは捨てる）
    let mut target: Option<usize> = None;
    for line in lines.iter().map(|line| line.trim()).filter(|line| !line.is_empty()) {
        let Some(rest) = line.strip_prefix('@').or_else(|| line.strip_prefix('＠')) else {
            if let Some(task) = target.and_then(|index| tasks.get_mut(index)) {
                append(&mut task.instruction, line);
            }
            continue;
        };
        target = match resolve(rest, &keys) {
            Some((agent, instruction)) if &agent.id != author => {
                let index = tasks.iter().position(|task| task.assignee == agent.id).unwrap_or_else(|| {
                    tasks.push(PlannedTask { assignee: agent.id.clone(), instruction: String::new() });
                    tasks.len() - 1
                });
                if let Some(task) = tasks.get_mut(index) {
                    append(&mut task.instruction, instruction);
                }
                Some(index)
            }
            found => {
                let name = found.map_or_else(|| written_name(rest), |(agent, _)| agent.name.clone());
                if !plan.unassignable.contains(&name) {
                    plan.unassignable.push(name);
                }
                None
            }
        };
    }
    tasks.retain(|task| !task.instruction.is_empty());
    if tasks.len() > MAX_SUBTASKS {
        let skipped = tasks.split_off(MAX_SUBTASKS);
        plan.overflow = skipped.iter().filter_map(|task| name_of(&keys, &task.assignee)).collect();
    }
    plan.tasks = tasks;
    Some(plan)
}

/// 最初の ```tasks ブロックの行（閉じていなければ最後まで）。ほかのコードブロックの中は飛ばす
fn tasks_block(content: &str) -> Option<Vec<&str>> {
    let mut lines = content.lines();
    let mut in_other_block = false;
    while let Some(line) = lines.next() {
        let Some(info) = line.trim().strip_prefix(FENCE) else {
            continue;
        };
        let info = info.trim();
        if in_other_block {
            in_other_block = !info.is_empty();
        } else if info.eq_ignore_ascii_case("tasks") {
            return Some(lines.take_while(|line| line.trim() != FENCE).collect());
        } else {
            in_other_block = true;
        }
    }
    None
}

/// `名前: 指示` の名前を引く。区切り（`:`・`：`・空白）の手前が名前に一致する候補のうち、いちばん長い名前を選ぶ
fn resolve<'a, 'b>(rest: &'b str, keys: &[(String, &'a Agent)]) -> Option<(&'a Agent, &'b str)> {
    let ends = rest.char_indices().filter(|(_, c)| is_separator(*c)).map(|(index, _)| index);
    let mut best: Option<(usize, &Agent, usize)> = None;
    for end in ends.chain(std::iter::once(rest.len())) {
        if rest[..end].chars().count() > NAME_PROBE_CHARS {
            break;
        }
        let key = name_key(rest[..end].trim());
        let Some((_, agent)) = keys.iter().find(|(candidate, _)| *candidate == key) else {
            continue;
        };
        let length = key.chars().count();
        if best.is_none_or(|(known, _, _)| length > known) {
            best = Some((length, agent, end));
        }
    }
    best.map(|(_, agent, end)| (agent, instruction_after(&rest[end..])))
}

fn is_separator(c: char) -> bool {
    c == ':' || c == '：' || c.is_whitespace()
}

/// 区切りのあとの指示（先頭の空白と `:` を1つ除く）
fn instruction_after(rest: &str) -> &str {
    let rest = rest.trim_start();
    rest.strip_prefix(':').or_else(|| rest.strip_prefix('：')).unwrap_or(rest).trim()
}

/// 割り振れなかった行に書かれていた名前
fn written_name(rest: &str) -> String {
    let end = rest.char_indices().find(|(_, c)| is_separator(*c)).map_or(rest.len(), |(index, _)| index);
    match rest[..end].trim() {
        "" => "（名前なし）".to_owned(),
        name => name.to_owned(),
    }
}

fn append(instruction: &mut String, text: &str) {
    if text.is_empty() {
        return;
    }
    if !instruction.is_empty() {
        instruction.push('\n');
    }
    instruction.push_str(text);
}

fn name_of(keys: &[(String, &Agent)], id: &AgentId) -> Option<String> {
    keys.iter().find(|(_, agent)| &agent.id == id).map(|(_, agent)| agent.name.clone())
}
