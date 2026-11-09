//! runner-client の型と、ドメイン・ポートの型の変換。

use guild_application::ports::{ImagePayload, RuntimeError, RuntimeRequest, SkillPayload};
use guild_domain::agent::{PermissionKey, Permissions};
use guild_domain::backend::{
    BackendInfo, BackendStatus, OptionSpec, OptionType, PermissionRule, RuntimeState, RuntimeStatus,
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
        model_suggestions: info.model_suggestions,
        default_model: info.default_model,
        capabilities: permissions_from(info.capabilities),
        status: match info.status {
            runner::BackendStatus::Ready => BackendStatus::Ready,
            runner::BackendStatus::NeedsAuth => BackendStatus::NeedsAuth,
            runner::BackendStatus::Unavailable => BackendStatus::Unavailable,
        },
        status_message: info.status_message,
        options: info.options.into_iter().map(option).collect(),
        permission_rules: info.permission_rules.into_iter().map(rule).collect(),
        can_login: info.can_login,
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
