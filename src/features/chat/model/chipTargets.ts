// メンションのチップにする相手と色（accent）の決め方。
import { agentAccent, HUMAN_ACCENT } from '@/features/agents';
import { normalizeName } from '@/shared/lib/names';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Agent, AgentTemplate, Profile } from '@/shared/types/domain';
import type { ChipTarget } from './markdown';

/**
 * エージェントは先頭のタグの色（テンプレートの accent。決まらなければ中立）、自分宛ては人間の色、
 * 削除済みの相手は既定の色（同じ名前の現役か人間がいればそちらを優先して、削除済みはチップにしない）
 */
export function mentionChipTargets(
  agents: readonly Agent[],
  templates: readonly AgentTemplate[],
  me: Pick<Profile, 'name'>,
): ChipTarget[] {
  const active = agents.filter((agent) => agent.deletedAt === null);
  const activeNames = new Set([...active.map((agent) => normalizeName(agent.name)), normalizeName(me.name)]);
  const deleted = agents.filter((agent) => agent.deletedAt !== null && !activeNames.has(normalizeName(agent.name)));
  return [
    ...active.map((agent): ChipTarget => ({
      id: agent.id,
      name: agent.name,
      kind: 'agent',
      accent: agentAccent(templates, agent),
    })),
    { id: HUMAN_ID, name: me.name, kind: 'human', accent: HUMAN_ACCENT },
    ...deleted.map((agent): ChipTarget => ({ id: agent.id, name: agent.name, kind: 'deleted', accent: null })),
  ];
}
