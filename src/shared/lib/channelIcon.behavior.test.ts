// Rust（guild-domain の normalize_channel_icon）と同じ実例で、アイコンの規則が同じ結果になることを検査する。
import { describe, expect, it } from 'vitest';
import { behaviorFixture } from './behaviorFixtures.test-support';
import { channelMark, channelTitle, normalizeChannelIcon } from './channelIcon';

interface IconCase {
  name: string;
  icon: string;
  result: string | null;
}

describe('チャンネルのアイコン（Rust と共通の実例）', () => {
  it.each(behaviorFixture<IconCase[]>('channel-icons.json'))('$name', ({ icon, result }) => {
    expect(normalizeChannelIcon(icon)).toBe(result);
  });
});

describe('channelMark', () => {
  it('アイコンがなければ #、あればアイコン', () => {
    expect(channelMark({ icon: '' })).toBe('#');
    expect(channelMark({ icon: '🎨' })).toBe('🎨');
    expect(channelTitle({ icon: '', name: '設計' })).toBe('#設計');
    expect(channelTitle({ icon: '🎨', name: '設計' })).toBe('🎨 設計');
  });
});
