// Rust（guild-domain の parse_tasks）と同じ実例で、tasks ブロックの読み取りが同じ結果になることを検査する。
// 画面が tasks ブロックを取り除くときの見つけ方（findTasksBlock）も、ブロックの有無が同じになること。
import { describe, expect, it } from 'vitest';
import { activeFixtureAgents, behaviorFixture } from '@/shared/lib/behaviorFixtures.test-support';
import type { FixtureAgent } from '@/shared/lib/behaviorFixtures.test-support';
import { findTasksBlock } from '@/shared/lib/tasksBlock';
import type { Agent } from '@/shared/types/domain';
import { parseTasks } from './tasks';

interface TasksCase {
  name: string;
  /** tasks-agents.json の teams のキー */
  agents: string;
  content: string;
  plan: { tasks: { assignee: string; instruction: string }[]; unassignable: string[]; overflow: string[] } | null;
}

const { author, teams } = behaviorFixture<{ author: string; teams: Record<string, FixtureAgent[]> }>(
  'tasks-agents.json',
);

describe('tasks ブロックの読み取り（Rust と共通の実例）', () => {
  it.each(behaviorFixture<TasksCase[]>('tasks.json'))('$name', ({ agents, content, plan }) => {
    const members = activeFixtureAgents(teams[agents] ?? []).map((agent) => ({ ...agent, deletedAt: null }) as Agent);
    const parsed = parseTasks(content, members, author);
    const actual = parsed && {
      tasks: parsed.entries.map((entry) => ({ assignee: entry.assigneeId, instruction: entry.instruction })),
      unassignable: parsed.skipped,
      overflow: parsed.overflow,
    };
    expect(actual).toEqual(plan);
    expect(findTasksBlock(content) !== null).toBe(plan !== null);
  });
});
