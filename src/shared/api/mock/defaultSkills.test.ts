import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AgentInput } from '@/shared/types/domain';
import { createHarness } from './harness.test-support';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('発想役と専門家だけに既定スキルを付け、通常の保存では外したものを復活させない', async () => {
  const { transport } = await createHarness({ demo: false });
  const snapshot = await transport.invoke('get_snapshot', {});
  const starter = snapshot.agents[0]!;
  const original: AgentInput = { ...starter };
  expect(await transport.invoke('list_skills', { agentId: starter.id })).toEqual([]);
  for (const template of snapshot.templates) {
    const input = { ...original, ...template.defaults, name: template.label };
    const agent = await transport.invoke('create_agent', { input });
    const skills = await transport.invoke('list_skills', { agentId: agent.id });
    expect(skills.map((skill) => skill.name).sort()).toEqual([...template.builtinSkills].sort());
    expect(skills).toHaveLength(template.id === 'ideator' ? 2 : template.id === 'expert' ? 1 : 0);
    expect(skills.every((skill) => skill.source?.kind === 'builtin')).toBe(true);
  }
  const ideator = snapshot.templates.find((item) => item.id === 'ideator')!;
  const input = { ...original, ...ideator.defaults };
  await transport.invoke('update_agent', { id: starter.id, input });
  const initial = await transport.invoke('list_skills', { agentId: starter.id });
  expect(initial).toHaveLength(2);
  await transport.invoke('delete_skill', { id: initial[0]!.id });
  await transport.invoke('update_agent', { id: starter.id, input });
  expect(await transport.invoke('list_skills', { agentId: starter.id })).toHaveLength(1);
  const expert = snapshot.templates.find((item) => item.id === 'expert')!;
  await transport.invoke('update_agent', { id: starter.id, input: { ...original, ...expert.defaults } });
  const changed = await transport.invoke('list_skills', { agentId: starter.id });
  expect(changed).toHaveLength(2);
  expect(changed.map((skill) => skill.name)).toContain('universal-critique');
});
