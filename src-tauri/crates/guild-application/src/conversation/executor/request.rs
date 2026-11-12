//! 実行の依頼（RuntimeRequest）を組み立てる: 作業場所・権限・スキル・MEMORY.md・履歴（history.rs）・割り振り・プロンプト。
//! ランナーに渡す権限は役割で決まるもの。プロンプトの「できること」は、そのうちこのバックエンドで実際に使える操作。

use std::path::PathBuf;

use guild_domain::agent::Agent;
use guild_domain::attachment::Attachment;
use guild_domain::channel::{Channel, WorkspaceMode};
use guild_domain::conversation::{file_attachments, image_messages, JobSpec};
use guild_domain::delegation::Delegation;
use guild_domain::message::Message;
use guild_domain::prompt::{
    build_conversation_prompt, build_intent, build_system_prompt, ConsultSource, PromptContext,
};
use guild_domain::skill::{builtin_skill_files, Skill};

use super::history::history;
use crate::error::AppResult;
use crate::ports::{ImagePayload, RuntimeRequest, SkillFilePayload, SkillPayload};
use crate::services::Ports;
use crate::skills::sources;

/// エージェントが削除・除外されているか、チャンネルがなければ None（実行しない）
pub(super) fn build(ports: &Ports, job: &JobSpec) -> AppResult<Option<RuntimeRequest>> {
    let Some((agent, channel)) = participants(ports, job)? else {
        return Ok(None);
    };
    let backends = ports.runtime.backends();
    let backend = backends.iter().find(|b| b.id == agent.backend);
    if !super::request_scope::accepts_job(ports, job, &channel)? {
        return Ok(None);
    }
    let super::request_scope::RunScope { permissions, usable, paths, memory, writable_dirs } =
        super::request_scope::prepare(ports, &agent, &channel, backend)?;
    let skills = if usable.skills { runnable_skills(ports, &agent)? } else { Vec::new() };
    let agents = ports.agents.list()?;
    let me = ports.profile.get()?;
    let history: Vec<_> = history(ports, job)?.into_iter().filter(|m| m.seq > channel.workspace.after_seq).collect();
    let (sources, mut readable_dirs) = consult_sources(ports, job, &agents, &channel);
    if let Some(roots) = &writable_dirs {
        readable_dirs.extend(roots.iter().cloned());
    }
    // 添えられたファイルはパスを伝えて読んでもらうので、そのチャンネルの添付のフォルダを読めるようにする
    if !file_attachments(job, &history).is_empty() {
        readable_dirs.push(ports.attachments.channel_dir(&channel.id));
    }
    let delegation = delegation_of(ports, job)?;
    let now_label = ports.clock.local_label(ports.clock.now_ms());
    let clock = ports.clock.clone();
    let time_label = move |ms: i64| clock.local_label(ms);
    let attachment_path = |message: &Message, attachment: &Attachment| {
        ports.attachments.path(&message.channel_id, attachment).display().to_string()
    };
    let ctx = PromptContext {
        agent: &agent,
        permissions: usable,
        channel: &channel,
        agents: &agents,
        backends: &backends,
        me: &me,
        skills: &skills,
        memory: &memory,
        now_label: &now_label,
        time_label: &time_label,
        attachment_path: &attachment_path,
        delegation: delegation.as_ref(),
    };
    Ok(Some(RuntimeRequest {
        backend: agent.backend.clone(),
        workspace: paths.work,
        state_dir: paths.state,
        readable_dirs,
        writable_dirs,
        system_prompt: super::request_scope::with_scope(build_system_prompt(&ctx), &channel, backend),
        prompt: build_conversation_prompt(&ctx, &history, job, &sources),
        intent: build_intent(&ctx, &history, job),
        model: agent.model.clone(),
        permissions,
        skills: skills.iter().map(payload).collect(),
        images: image_payloads(ports, job, &history),
        options: agent.backend_options.clone(),
    }))
}

/// 応える発言と会話の起点に貼られた画像（発言の順。選び方は guild-domain の image_messages。ファイルは含めない）
fn image_payloads(ports: &Ports, job: &JobSpec, history: &[Message]) -> Vec<ImagePayload> {
    image_messages(job, history)
        .into_iter()
        .flat_map(|message| {
            message.attachments.iter().filter(|attachment| attachment.is_image()).map(move |attachment| ImagePayload {
                path: ports.attachments.path(&message.channel_id, attachment),
                media_type: attachment.media_type.clone(),
            })
        })
        .collect()
}

/// 実行してよい相手か: 削除されていないエージェントが、存在するチャンネルのメンバーであること
pub(super) fn participants(ports: &Ports, job: &JobSpec) -> AppResult<Option<(Agent, Channel)>> {
    let agent = ports.agents.get(&job.agent_id)?.filter(Agent::is_active);
    let channel = ports.channels.get(&job.channel_id)?;
    Ok(match (agent, channel) {
        (Some(agent), Some(channel)) if channel.has_agent(&agent.id) => Some((agent, channel)),
        _ => None,
    })
}

/// 相談のジョブでは、呼び出し元の作業場所を読めるようにしてプロンプトでも伝える
fn consult_sources(
    ports: &Ports,
    job: &JobSpec,
    agents: &[Agent],
    channel: &Channel,
) -> (Vec<ConsultSource>, Vec<PathBuf>) {
    job.return_to
        .iter()
        .filter_map(|id| agents.iter().find(|agent| &agent.id == id && agent.is_active()))
        .map(|caller| {
            let path = if channel.workspace.mode == WorkspaceMode::Shared {
                ports.workspace.work_dir(&caller.id)
            } else {
                ports.workspace.scoped_work_dir(&caller.id, &channel.id, channel.workspace.revision)
            };
            let source = ConsultSource { name: caller.name.clone(), path: path.display().to_string() };
            (source, path)
        })
        .unzip()
}

/// まとめのジョブはその割り振り、サブタスクを進めるジョブはサブタスクの割り振り（プロンプトに指示と結果を出す）
fn delegation_of(ports: &Ports, job: &JobSpec) -> AppResult<Option<Delegation>> {
    match job.report.as_ref().or(job.subtask.as_ref().map(|target| &target.delegation_id)) {
        Some(id) => ports.delegations.get(id),
        None => Ok(None),
    }
}

/// linked のスキルは SKILL.md を読み直したもの（読めなければ外す）
fn runnable_skills(ports: &Ports, agent: &Agent) -> AppResult<Vec<Skill>> {
    let skills = ports.skills.list_for_agent(&agent.id)?;
    Ok(sources::runnable(ports.library.as_ref(), &agent.name, skills))
}

fn payload(skill: &Skill) -> SkillPayload {
    SkillPayload {
        name: skill.name.clone(),
        description: skill.description.clone(),
        body: skill.body.clone(),
        dir: skill.linked_path().map(PathBuf::from),
        files: skill
            .builtin_name()
            .map(builtin_skill_files)
            .unwrap_or_default()
            .into_iter()
            .map(|file| SkillFilePayload { path: file.path, content: file.content })
            .collect(),
    }
}
