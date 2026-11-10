//! runner-client の型と、ドメイン・ポートの型の変換。

use guild_application::ports::{ImagePayload, RunUpdate, RuntimeError, RuntimeRequest, SkillPayload};
use guild_domain::agent::{PermissionKey, Permissions};
use guild_domain::backend::{
    BackendInfo, BackendStatus, MidRunPost, ModelSpec, OptionSpec, OptionType, PermissionRule, RuntimeState,
    RuntimeStatus,
};
use runner_client as runner;

pub(super) fn status(status: runner::RunnerStatus) -> RuntimeStatus {
    match status {
        runner::RunnerStatus::Starting => RuntimeStatus { state: RuntimeState::Starting, message: String::new() },
        runner::RunnerStatus::Ready => RuntimeStatus { state: RuntimeState::Ready, message: String::new() },
        runner::RunnerStatus::Unavailable { message } => RuntimeStatus { state: RuntimeState::Unavailable, message },
    }
}

pub(super) fn backend(info: runner::BackendInfo) -> BackendInfo {
    BackendInfo {
        id: info.id,
        label: info.label,
        models: info.models.into_iter().map(model).collect(),
        default_model: info.default_model,
        capabilities: permissions_from(info.capabilities),
        status: match info.status {
            runner::BackendStatus::Ready => BackendStatus::Ready,
            runner::BackendStatus::NeedsAuth => BackendStatus::NeedsAuth,
            runner::BackendStatus::Stopped => BackendStatus::Stopped,
            runner::BackendStatus::Unavailable => BackendStatus::Unavailable,
        },
        status_message: info.status_message,
        options: info.options.into_iter().map(option).collect(),
        permission_rules: info.permission_rules.into_iter().map(rule).collect(),
        leak_risks: info.leak_risks.into_iter().map(|risk| risk.into_iter().map(key).collect()).collect(),
        can_login: info.can_login,
        mid_run_post: info.mid_run_post.map(mid_run_post),
    }
}

fn model(spec: runner::ModelSpec) -> ModelSpec {
    ModelSpec {
        id: spec.id,
        label: spec.label,
        description: spec.description,
        efforts: spec.efforts,
        default_effort: spec.default_effort,
    }
}

fn mid_run_post(method: runner::MidRunPost) -> MidRunPost {
    match method {
        runner::MidRunPost::Tool => MidRunPost::Tool,
        runner::MidRunPost::Text => MidRunPost::Text,
    }
}

/// 実行中の知らせ（途中経過・途中の投稿）
pub(super) fn update(update: runner::RunUpdate) -> RunUpdate {
    match update {
        runner::RunUpdate::Activity(detail) => RunUpdate::Activity(detail),
        runner::RunUpdate::Post(text) => RunUpdate::Post(text),
        runner::RunUpdate::Usage(usage) => RunUpdate::Usage(guild_domain::statistics::RunUsage {
            model: usage.model,
            input_tokens: usage.input_tokens.and_then(|value| i64::try_from(value).ok()),
            output_tokens: usage.output_tokens.and_then(|value| i64::try_from(value).ok()),
            estimated_cost_nano_usd: usage.estimated_cost_nano_usd.and_then(|value| i64::try_from(value).ok()),
        }),
    }
}

fn rule(rule: runner::PermissionRule) -> PermissionRule {
    PermissionRule { when: key(rule.when), requires: rule.requires.into_iter().map(key).collect() }
}

fn key(key: runner::PermissionKey) -> PermissionKey {
    match key {
        runner::PermissionKey::WebSearch => PermissionKey::WebSearch,
        runner::PermissionKey::WebFetch => PermissionKey::WebFetch,
        runner::PermissionKey::ReadFiles => PermissionKey::ReadFiles,
        runner::PermissionKey::WriteFiles => PermissionKey::WriteFiles,
        runner::PermissionKey::WriteAnywhere => PermissionKey::WriteAnywhere,
        runner::PermissionKey::RunCommands => PermissionKey::RunCommands,
        runner::PermissionKey::Skills => PermissionKey::Skills,
    }
}

fn option(spec: runner::OptionSpec) -> OptionSpec {
    OptionSpec {
        key: spec.key,
        label: spec.label,
        description: spec.description,
        value_type: match spec.kind {
            runner::OptionKind::String => OptionType::String,
            runner::OptionKind::Number => OptionType::Number,
            runner::OptionKind::Boolean => OptionType::Boolean,
            runner::OptionKind::Select => OptionType::Select,
        },
        choices: spec.choices,
        default: spec.default,
    }
}

pub(super) fn request(request: RuntimeRequest) -> runner::RunRequest {
    runner::RunRequest {
        backend: request.backend,
        workspace: request.workspace,
        state_dir: request.state_dir,
        readable_dirs: request.readable_dirs,
        system_prompt: request.system_prompt,
        prompt: request.prompt,
        intent: request.intent,
        model: request.model,
        permissions: permissions_to(request.permissions),
        skills: request.skills.into_iter().map(skill).collect(),
        images: request.images.into_iter().map(image).collect(),
        options: request.options,
    }
}

fn skill(skill: SkillPayload) -> runner::SkillPayload {
    runner::SkillPayload { name: skill.name, description: skill.description, body: skill.body, dir: skill.dir }
}

fn image(image: ImagePayload) -> runner::ImagePayload {
    runner::ImagePayload { path: image.path, media_type: image.media_type }
}

/// 中断は独立に、それ以外は日本語のメッセージの失敗として返す
pub(super) fn error(error: runner::RunnerError) -> RuntimeError {
    match error {
        runner::RunnerError::Cancelled => RuntimeError::Cancelled,
        other => RuntimeError::Failed(other.to_string()),
    }
}

fn permissions_from(p: runner::Permissions) -> Permissions {
    Permissions {
        web_search: p.web_search,
        web_fetch: p.web_fetch,
        read_files: p.read_files,
        write_files: p.write_files,
        write_anywhere: p.write_anywhere,
        run_commands: p.run_commands,
        skills: p.skills,
    }
}

fn permissions_to(p: Permissions) -> runner::Permissions {
    runner::Permissions {
        web_search: p.web_search,
        web_fetch: p.web_fetch,
        read_files: p.read_files,
        write_files: p.write_files,
        write_anywhere: p.write_anywhere,
        run_commands: p.run_commands,
        skills: p.skills,
    }
}
