//! メンバーと発言者の表示。

use super::{capabilities, PromptContext};
use crate::agent::{effective_permissions, Agent};
use crate::author::{Author, MemberId};
use crate::backend::{BackendInfo, EFFORT_OPTION};
use crate::ids::AgentId;

/// チャンネルのメンバー一覧（自分と削除済みを除く。参加順）
pub(super) fn member_list(ctx: &PromptContext<'_>) -> String {
    let lines: Vec<String> = ctx
        .channel
        .member_ids
        .iter()
        .filter_map(|member| match member {
            MemberId::Human => Some(format!("- {}（人間・このアプリの使用者）", ctx.me.name)),
            MemberId::Agent(id) => find(ctx.agents, id)
                .filter(|agent| agent.is_active() && agent.id != ctx.agent.id)
                .map(|agent| profile_line(agent, ctx)),
        })
        .collect();
    if lines.is_empty() {
        "（あなた以外にはいません）".to_owned()
    } else {
        lines.join("\n")
    }
}

/// メンバー一覧の1行: プロフィール・実効権限と、バックエンド・モデル・推論の深さの設定
pub(super) fn profile_line(agent: &Agent, ctx: &PromptContext<'_>) -> String {
    let backend = ctx.backends.iter().find(|backend| backend.id == agent.backend);
    let permissions = effective_permissions(agent, backend);
    let mut parts: Vec<String> = Vec::new();
    let mut push = |label: &str, value: &str| {
        let value = value.trim();
        if !value.is_empty() {
            parts.push(format!("{label}: {value}"));
        }
    };
    push("タグ", &agent.tags.join("・"));
    push("担当", &agent.role);
    push("得意分野", &agent.expertise);
    push("できること", &capabilities::summary(&permissions));
    push("バックエンド", backend.and_then(|info| non_empty(&info.label)).unwrap_or(&agent.backend));
    push("モデル", &model_setting(agent, backend));
    push("エフォート", &effort_setting(agent, backend));
    format!("- @{}（{}）", agent.name, parts.join("／"))
}

fn non_empty(value: &str) -> Option<&str> {
    let value = value.trim();
    (!value.is_empty()).then_some(value)
}

fn model_setting(agent: &Agent, backend: Option<&BackendInfo>) -> String {
    if let Some(model) = non_empty(&agent.model) {
        return model.to_owned();
    }
    match backend.and_then(|info| non_empty(&info.default_model)) {
        Some(model) => format!("既定（{model}）"),
        None => "既定（バックエンドに任せる）".to_owned(),
    }
}

fn effort_setting(agent: &Agent, backend: Option<&BackendInfo>) -> String {
    if let Some(effort) = agent.backend_options.get(EFFORT_OPTION).and_then(|value| value.as_str()).and_then(non_empty)
    {
        return effort.to_owned();
    }
    let spec = backend.and_then(|info| info.model_spec(agent.model.trim()));
    if let Some(effort) = spec.and_then(|model| model.default_effort.as_deref()).and_then(non_empty) {
        return format!("既定（{effort}）");
    }
    if spec.is_some_and(|model| model.efforts.is_empty()) {
        return "指定不可".to_owned();
    }
    "既定（モデルに任せる）".to_owned()
}

/// 会話履歴での発言者の表示名
pub(super) fn display_name(author: &Author, ctx: &PromptContext<'_>) -> String {
    match author {
        Author::Human => format!("{}（人間）", ctx.me.name),
        Author::System => "システム".to_owned(),
        Author::Agent(id) => match find(ctx.agents, id) {
            None => "（退出したメンバー）".to_owned(),
            Some(agent) if !agent.is_active() => format!("{}（退出したメンバー）", agent.name),
            Some(agent) if agent.id == ctx.agent.id => format!("{}（あなた自身）", agent.name),
            Some(agent) => agent.name.clone(),
        },
    }
}

/// 得意分野（なければ役割）
pub(super) fn specialty(agent: &Agent) -> &str {
    if !agent.expertise.trim().is_empty() {
        &agent.expertise
    } else {
        &agent.role
    }
}

pub(super) fn find<'a>(agents: &'a [Agent], id: &AgentId) -> Option<&'a Agent> {
    agents.iter().find(|agent| &agent.id == id)
}

/// エージェントの名前（見つからなければ「（退出したメンバー）」）
pub(super) fn name_of(ctx: &PromptContext<'_>, id: &AgentId) -> String {
    find(ctx.agents, id).map_or_else(|| "（退出したメンバー）".to_owned(), |agent| agent.name.clone())
}
