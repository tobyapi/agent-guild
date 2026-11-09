//! 初期データ（design.md §13）。meta 表に seeded の記録がないときだけ、ロビーと5人とスキル・歓迎の発言を入れる。
//! 中身は seed/ のデータ（agents.json と各スキルの Markdown）。各エージェントはテンプレートの既定値から作り、差分だけをデータに書く。

use std::error::Error;

use guild_application::ports::MetaRepository;
use guild_application::AppServices;
use guild_domain::agent::{find_template, AgentInput, PermissionKey};
use guild_domain::author::MemberId;
use guild_domain::skill::SkillInput;
use serde::Deserialize;

const SEEDED_KEY: &str = "seeded";
const AGENTS: &str = include_str!("seed/agents.json");
const SKILL_BODIES: [(&str, &str); 2] = [
    ("review-checklist", include_str!("seed/review-checklist.md")),
    ("code-review", include_str!("seed/code-review.md")),
];
const LOBBY_NAME: &str = "ロビー";
const LOBBY_TOPIC: &str = "みんなの雑談と相談の場";
const WELCOME: &str =
    "AIギルドへようこそ。マネージャーのカナメ、作業者のハル・ソラ、専門家のロジカ・ギアが参加しています。\
メンションなしで話しかけるとカナメが受けて、内容に合うメンバーに割り振ります。「@名前」で特定のメンバーを呼べます。";

#[derive(Deserialize)]
struct SeedAgent {
    /// 既定値を借りるテンプレートの ID
    template: String,
    profile: SeedProfile,
    /// テンプレートの権限に足すもの
    allow: Vec<PermissionKey>,
    skill: Option<SeedSkill>,
}

/// テンプレートでは決まらない、そのエージェントだけの項目（担当と得意分野は省けばテンプレートの書き出し）
#[derive(Deserialize)]
struct SeedProfile {
    name: String,
    avatar: String,
    color: String,
    tags: Vec<String>,
    role: Option<String>,
    personality: String,
    tone: String,
    expertise: Option<String>,
    backend: String,
    model: String,
}

#[derive(Deserialize)]
struct SeedSkill {
    name: String,
    description: String,
}

/// 初回だけ初期データを入れる（ユースケース経由なので入力規則の検証も通る）
pub fn run_once(services: &AppServices, meta: &dyn MetaRepository) -> Result<(), Box<dyn Error>> {
    if meta.get(SEEDED_KEY)?.is_some() {
        return Ok(());
    }
    let seeds: Vec<SeedAgent> = serde_json::from_str(AGENTS)?;
    let mut members = Vec::new();
    let mut skills = Vec::new();
    for seed in seeds {
        let agent = services.agents.create(agent_input(&seed)?)?;
        members.push(MemberId::Agent(agent.id.clone()));
        if let Some(skill) = seed.skill {
            skills.push((agent.id, skill));
        }
    }
    let lobby = services.channels.create(LOBBY_NAME, LOBBY_TOPIC, &members)?;
    for (agent_id, skill) in skills {
        let body = SKILL_BODIES
            .iter()
            .find(|(name, _)| *name == skill.name)
            .map(|(_, body)| (*body).to_owned())
            .unwrap_or_default();
        let input = SkillInput { id: None, agent_id, name: skill.name, description: skill.description, body };
        services.skills.save(input)?;
    }
    services.conversation.post_system(&lobby.id, WELCOME)?;
    meta.set(SEEDED_KEY, "1")?;
    log::info!("初期データを入れました");
    Ok(())
}

/// テンプレートの既定値に、そのエージェントの項目と追加の権限を重ねる
fn agent_input(seed: &SeedAgent) -> Result<AgentInput, String> {
    let defaults = find_template(&seed.template)
        .ok_or_else(|| format!("初期データのテンプレート {} がありません", seed.template))?
        .defaults;
    let mut permissions = defaults.permissions;
    seed.allow.iter().for_each(|key| permissions.allow(*key));
    let profile = &seed.profile;
    Ok(AgentInput {
        name: profile.name.clone(),
        avatar: profile.avatar.clone(),
        color: profile.color.clone(),
        tags: profile.tags.clone(),
        role: profile.role.clone().unwrap_or(defaults.role),
        personality: profile.personality.clone(),
        tone: profile.tone.clone(),
        expertise: profile.expertise.clone().unwrap_or(defaults.expertise),
        backend: profile.backend.clone(),
        model: profile.model.clone(),
        backend_options: serde_json::Map::new(),
        permissions,
        unmentioned: defaults.unmentioned,
        consultable: defaults.consultable,
        can_delegate: defaults.can_delegate,
        autonomy_enabled: defaults.autonomy_enabled,
        autonomy_interval_min: 60,
        autonomy_channel_id: None,
    })
}
