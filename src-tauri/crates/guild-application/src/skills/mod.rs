//! スキルのユースケース: 一覧・保存（新規と更新）・削除と、内蔵スキル（builtin）・スキルライブラリ（library）。
//! 変わったら skills-changed を出す。

mod builtin;
pub mod library;
pub(crate) mod sources;

use guild_domain::ids::{AgentId, SkillId};
use guild_domain::locale;
use guild_domain::skill::{
    normalize_skill_description, skill_name_taken, validate_skill_name, Skill, SkillInput, SkillSource,
};

use crate::error::{subject, AppError, AppResult};
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
        let skill = self.ports.skills.get(id)?.ok_or(AppError::NotFound(locale::pick([
            "スキル",
            "Skill",
            "技能",
            "技能",
            "스킬",
        ])))?;
        self.ports.skills.delete(id)?;
        self.ports.events.skills_changed(&skill.agent_id);
        Ok(())
    }

    /// 更新するスキルは存在し、同じエージェントのもので、linked・builtin ではないこと
    fn require_editable(&self, id: &SkillId, agent_id: &AgentId) -> AppResult<SkillId> {
        let skill = self.ports.skills.get(id)?.ok_or(AppError::NotFound(locale::pick([
            "スキル",
            "Skill",
            "技能",
            "技能",
            "스킬",
        ])))?;
        if &skill.agent_id != agent_id {
            return Err(AppError::validation(locale::pick([
                "別のエージェントのスキルは編集できません",
                "Skills of another agent cannot be edited",
                "不能编辑其他智能体的技能",
                "無法編輯其他代理人的技能",
                "다른 에이전트의 스킬은 편집할 수 없습니다",
            ])));
        }
        match skill.source {
            Some(SkillSource::Linked { .. }) => Err(AppError::validation(locale::pick([
                "リンクしたスキルはアプリ内では編集できません（元のフォルダの SKILL.md を編集してください）",
                "Linked skills cannot be edited in the app (edit SKILL.md in the original folder)",
                "链接的技能无法在应用内编辑（请编辑原文件夹中的 SKILL.md）",
                "連結的技能無法在應用程式內編輯（請編輯原資料夾中的 SKILL.md）",
                "링크한 스킬은 앱에서 편집할 수 없습니다(원래 폴더의 SKILL.md를 편집하십시오)",
            ]))),
            Some(SkillSource::Builtin { .. }) => Err(AppError::validation(locale::pick([
                "内蔵スキルはアプリ内では編集できません（「コピーして追加」すると編集できます）",
                "Built-in skills cannot be edited in the app (use “Copy and add” to make an editable copy)",
                "内置技能无法在应用内编辑（使用“复制并添加”后即可编辑）",
                "內建技能無法在應用程式內編輯（使用「複製並新增」後即可編輯）",
                "내장 스킬은 앱에서 편집할 수 없습니다(\"복사해서 추가\"하면 편집할 수 있습니다)",
            ]))),
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
        return Err(AppError::Conflict(skill_name_taken(name)));
    }
    Ok(())
}

pub(crate) fn require_agent(ports: &Ports, id: &AgentId) -> AppResult<()> {
    match ports.agents.get(id)? {
        Some(agent) if agent.is_active() => Ok(()),
        _ => Err(AppError::NotFound(subject::agent())),
    }
}
