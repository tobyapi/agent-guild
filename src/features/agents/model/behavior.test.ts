import { describe, expect, it } from 'vitest';
import { behaviorSummary } from './behavior';

describe('behaviorSummary', () => {
  it('当てはまる振る舞いだけを決まった順で返す', () => {
    expect(behaviorSummary({ unmentioned: 'lead', consultable: false, canDelegate: true, autonomyEnabled: false })).toEqual(['最初に受ける', '割り振り']);
    expect(behaviorSummary({ unmentioned: 'ignore', consultable: true, canDelegate: false, autonomyEnabled: true })).toEqual(['相談相手', '自分から動く']);
    expect(behaviorSummary({ unmentioned: 'answer', consultable: false, canDelegate: false, autonomyEnabled: false })).toEqual([]);
  });
});
