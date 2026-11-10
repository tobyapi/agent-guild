// 内蔵スキル（docs/design.md §14）: 一覧とエージェントへの追加（link: 参照する / copy: 取り込む）。
import type { Skill } from '@/shared/types/domain';
import { findBuiltinSkill, listBuiltinSkills } from '../builtinSkills';
import { fail, requireAgent } from '../runtime';
import type { HandlerGroup } from './types';

type BuiltinCommands = 'list_builtin_skills' | 'add_builtin_skill';

export const builtinSkillHandlers: HandlerGroup<BuiltinCommands> = {
  list_builtin_skills: () => listBuiltinSkills(),

  add_builtin_skill({ agentId, name, mode }, runtime) {
    requireAgent(runtime, agentId);
    const found = findBuiltinSkill(name) ?? fail('not_found', `内蔵スキル「${name}」が見つかりません`);
    if (runtime.state.skills.some((skill) => skill.agentId === agentId && skill.name === found.name)) {
      fail('conflict', `スキル「${found.name}」はすでにあります`);
    }
    const skill: Skill = {
      id: runtime.env.newId(),
      agentId,
      name: found.name,
      description: found.description,
      body: found.body,
      source: mode === 'link' ? { kind: 'builtin', name: found.name } : null,
      problem: null,
      updatedAt: runtime.env.now(),
    };
    runtime.state.skills.push(skill);
    runtime.bus.emit('skills-changed', { agentId });
    return skill;
  },
};
