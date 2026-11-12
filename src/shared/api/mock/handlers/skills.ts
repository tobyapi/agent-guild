// スキルの一覧・保存・削除。名前は変換せずに検証する（design.md §2）。変わったら skills-changed。
// リンクしたスキル・内蔵スキル（§14）は一覧のたびに読み直し、アプリ内では編集させない。
import { isValidSkillName, SKILL_DESCRIPTION_MAX, skillNameProblem } from '@/shared/lib/skillName';
import { textLength } from '@/shared/lib/validation';
import type { Skill, SkillInput } from '@/shared/types/domain';
import { readBuiltinSkill } from '../builtinSkills';
import { readLinkedSkill } from '../library';
import { fail, requireAgent } from '../runtime';
import type { MockCore } from '../runtime';
import type { HandlerGroup } from './types';

type SkillCommands = 'list_skills' | 'save_skill' | 'delete_skill';

function validateSkill(core: MockCore, input: SkillInput): void {
  if (!isValidSkillName(input.name)) fail('validation', skillNameProblem(), 'name');
  const description = input.description.trim();
  if (description === '') fail('validation', 'スキルの説明を入力してください', 'description');
  if (textLength(description) > SKILL_DESCRIPTION_MAX) {
    fail('validation', `説明は${SKILL_DESCRIPTION_MAX}文字以内にしてください`, 'description');
  }
  const duplicate = core.state.skills.some(
    (skill) => skill.agentId === input.agentId && skill.name === input.name && skill.id !== input.id,
  );
  if (duplicate) fail('conflict', `スキル「${input.name}」はすでにあります`);
}

export const skillHandlers: HandlerGroup<SkillCommands> = {
  list_skills({ agentId }, runtime) {
    requireAgent(runtime, agentId);
    return runtime.state.skills
      .filter((skill) => skill.agentId === agentId)
      .map((skill) =>
        skill.source?.kind === 'builtin' ? readBuiltinSkill(skill, skill.source.name) : readLinkedSkill(skill),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  save_skill({ input }, runtime) {
    requireAgent(runtime, input.agentId);
    validateSkill(runtime, input);
    const current = runtime.state.skills.find((skill) => skill.id === input.id);
    if (input.id !== null && !current) fail('not_found', 'スキルが見つかりません');
    if (current?.source?.kind === 'builtin')
      fail('validation', '内蔵スキルはアプリ内では編集できません（「コピーして追加」すると編集できます）');
    if (current?.source)
      fail(
        'validation',
        'ライブラリにリンクしたスキルはアプリ内では編集できません。元のフォルダの SKILL.md を直してください',
      );
    const saved: Skill = {
      id: input.id ?? runtime.env.newId(),
      agentId: input.agentId,
      name: input.name,
      description: input.description.trim(),
      body: input.body,
      source: null,
      problem: null,
      updatedAt: runtime.env.now(),
    };
    runtime.state.skills = [...runtime.state.skills.filter((skill) => skill.id !== saved.id), saved];
    runtime.bus.emit('skills-changed', { agentId: saved.agentId });
    return saved;
  },

  delete_skill({ id }, runtime) {
    const skill =
      runtime.state.skills.find((candidate) => candidate.id === id) ?? fail('not_found', 'スキルが見つかりません');
    runtime.state.skills = runtime.state.skills.filter((candidate) => candidate.id !== id);
    runtime.bus.emit('skills-changed', { agentId: skill.agentId });
    return null;
  },
};
