//! 内蔵スキルのユースケース: 一覧とエージェントへの追加（link = 参照してアプリの更新に追従 / copy = 取り込んで編集できる）。

use guild_domain::ids::{AgentId, SkillId};
use guild_domain::skill::{builtin_skills, find_builtin_skill, BuiltinSkill, LibraryAddMode, Skill, SkillSource};

use super::{ensure_name_free, require_agent, SkillService};
use crate::error::{AppError, AppResult};

impl SkillService {
    /// 役割の既定スキルを追加する。同名の手動スキルやコピーは上書きしない。
    pub(crate) fn add_role_defaults(&self, agent: &guild_domain::agent::Agent) -> AppResult<()> {
        let Some(template) = guild_domain::agent::role_template(&agent.tags) else {
            return Ok(());
        };
        let existing = self.ports.skills.list_for_agent(&agent.id)?;
        for name in template.builtin_skills {
            if !existing.iter().any(|skill| skill.name == name) {
                self.add_builtin(&agent.id, &name, LibraryAddMode::Link)?;
            }
        }
        Ok(())
    }

    /// アプリに同梱した内蔵スキル（name の順）
    pub fn builtins(&self) -> Vec<BuiltinSkill> {
        builtin_skills()
    }

    /// 内蔵スキルをエージェントに付ける。同じ name があれば Conflict、内蔵スキルがなければ NotFound
    pub fn add_builtin(&self, agent_id: &AgentId, name: &str, mode: LibraryAddMode) -> AppResult<Skill> {
        require_agent(&self.ports, agent_id)?;
        let found = find_builtin_skill(name).ok_or(AppError::NotFound("内蔵スキル"))?;
        ensure_name_free(&self.ports, agent_id, &found.name, None)?;
        let source = match mode {
            LibraryAddMode::Link => Some(SkillSource::Builtin { name: found.name.clone() }),
            LibraryAddMode::Copy => None,
        };
        let skill = Skill {
            id: SkillId::new(self.ports.ids.new_id()),
            agent_id: agent_id.clone(),
            name: found.name,
            description: found.description,
            body: found.body,
            source,
            problem: None,
            updated_at: self.ports.clock.now_ms(),
        };
        self.ports.skills.upsert(&skill)?;
        self.ports.events.skills_changed(agent_id);
        Ok(skill)
    }
}
