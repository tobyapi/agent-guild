// Rust（guild-domain の parse_mentions）と同じ実例で、メンション解析が同じ結果になることを検査する。
import { describe, expect, it } from 'vitest';
import { activeFixtureAgents, behaviorFixture } from './behaviorFixtures.test-support';
import type { FixtureAgent } from './behaviorFixtures.test-support';
import { parseMentions } from './mentions';

interface MentionCase {
  name: string;
  agents: FixtureAgent[];
  content: string;
  mentions: string[];
}

describe('メンション解析（Rust と共通の実例）', () => {
  it.each(behaviorFixture<MentionCase[]>('mentions.json'))('$name', ({ agents, content, mentions }) => {
    expect(parseMentions(content, activeFixtureAgents(agents))).toEqual(mentions);
  });
});
