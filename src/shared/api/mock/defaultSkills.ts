// 作成・役割変更時に、役割の表にある内蔵スキルを参照として追加する。
import { permissionRole } from '@/shared/lib/permissionPolicy';
import type { Agent, AgentTemplate, Skill } from '@/shared/types/domain';
import { findBuiltinSkill } from './builtinSkills';
import type { MockCore } from './runtime';

export function roleSkills(agent: Agent, templates: AgentTemplate[], newId: () => string, now: number): Skill[] {
  const template = permissionRole(templates, agent.tags);
  return (template?.builtinSkills ?? []).map((name) => {
    const found = findBuiltinSkill(name);
    if (!found) throw new Error(`内蔵スキル「${name}」が見つかりません`);
    return {
      id: newId(),
      agentId: agent.id,
      name,
      description: found.description,
      body: found.body,
      source: { kind: 'builtin', name },
      problem: null,
      updatedAt: now,
    };
  });
}

export function addRoleSkills(runtime: MockCore, agent: Agent): void {
  const existing = runtime.state.skills.filter((skill) => skill.agentId === agent.id);
  const skills = roleSkills(agent, runtime.state.templates, runtime.env.newId, runtime.env.now());
  for (const skill of skills) {
    if (existing.some((item) => item.name === skill.name)) continue;
    runtime.state.skills.push(skill);
    runtime.bus.emit('skills-changed', { agentId: agent.id });
  }
}
