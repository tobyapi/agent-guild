//! スキルのユースケース: 一覧・保存（新規と更新）・削除と、内蔵スキル（builtin）・スキルライブラリ（library）。
//! 変わったら skills-changed を出す。

mod builtin;
pub mod library;
pub(crate) mod sources;

use guild_domain::ids::{AgentId, SkillId};
use guild_domain::skill::{normalize_skill_description, validate_skill_name, Skill, SkillInput, SkillSource};

use crate::error::{AppError, AppResult};
use crate::services::Ports;

#[derive(Clone)]
pub struct SkillService {
    ports: Ports,
}

impl SkillService {
    pub fn new(ports: Ports) -> Self {
        Self { ports }
    }

    /// linked・builtin のスキルは参照先を読み直した内容で返す（読めなければ problem に理由）
    pub fn list(&self, agent_id: &AgentId) -> AppResult<Vec<Skill>> {
        require_agent(&self.ports, agent_id)?;
        let skills = self.ports.skills.list_for_agent(agent_id)?;
        Ok(skills.into_iter().map(|skill| sources::refresh(self.ports.library.as_ref(), skill)).collect())
    }

    /// id が None なら新規。name は変換せずに検証し、同じエージェントで重なれば Conflict。linked・builtin は編集できない
    pub fn save(&self, input: SkillInput) -> AppResult<Skill> {
        require_agent(&self.ports, &input.agent_id)?;
        validate_skill_name(&input.name)?;
        let description = normalize_skill_description(&input.description)?;
        let id = match &input.id {
            Some(id) => self.require_editable(id, &input.agent_id)?,
            None => SkillId::new(self.ports.ids.new_id()),
        };
        ensure_name_free(&self.ports, &input.agent_id, &input.name, Some(&id))?;
        let skill = Skill {
            id,
            agent_id: input.agent_id,
            name: input.name,
            description,
            body: input.body,
            source: None,
            problem: None,
            updated_at: self.ports.clock.now_ms(),
        };
        self.ports.skills.upsert(&skill)?;
        self.ports.events.skills_changed(&skill.agent_id);
        Ok(skill)
    }

    /// linked・builtin なら参照を外すだけ（元のフォルダや内蔵スキルは消えない）
    pub fn delete(&self, id: &SkillId) -> AppResult<()> {
        let skill = self.ports.skills.get(id)?.ok_or(AppError::NotFound("スキル"))?;
        self.ports.skills.delete(id)?;
        self.ports.events.skills_changed(&skill.agent_id);
        Ok(())
    }

    /// 更新するスキルは存在し、同じエージェントのもので、linked・builtin ではないこと
    fn require_editable(&self, id: &SkillId, agent_id: &AgentId) -> AppResult<SkillId> {
        let skill = self.ports.skills.get(id)?.ok_or(AppError::NotFound("スキル"))?;
        if &skill.agent_id != agent_id {
            return Err(AppError::validation("別のエージェントのスキルは編集できません"));
        }
        match skill.source {
            Some(SkillSource::Linked { .. }) => Err(AppError::validation(
                "リンクしたスキルはアプリ内では編集できません（元のフォルダの SKILL.md を編集してください）",
            )),
            Some(SkillSource::Builtin { .. }) => Err(AppError::validation(
                "内蔵スキルはアプリ内では編集できません（「コピーして追加」すると編集できます）",
            )),
            None => Ok(skill.id),
        }
    }
}

/// 同じエージェントに同じ name のスキル（except 以外）があれば Conflict
pub(crate) fn ensure_name_free(
    ports: &Ports,
    agent_id: &AgentId,
    name: &str,
    except: Option<&SkillId>,
) -> AppResult<()> {
    let taken =
        ports.skills.list_for_agent(agent_id)?.into_iter().any(|skill| skill.name == name && Some(&skill.id) != except);
    if taken {
        return Err(AppError::Conflict(format!("「{name}」という名前のスキルはすでにあります")));
    }
    Ok(())
}

pub(crate) fn require_agent(ports: &Ports, id: &AgentId) -> AppResult<()> {
    match ports.agents.get(id)? {
        Some(agent) if agent.is_active() => Ok(()),
        _ => Err(AppError::NotFound("エージェント")),
    }
}
