import { describe, expect, it } from 'vitest';
import type { Message } from '@/shared/types/domain';
import { MIN_SOUND_GAP_MS, mentionsMe, soundForMessage } from './incoming';
import type { IncomingContext } from './incoming';
import { DEFAULT_SOUND_PREFERENCES } from './preferences';
import type { SoundPreferences } from './preferences';

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  seq: 1,
  channelId: 'c',
  authorId: 'hal',
  content: 'できました',
  attachments: [],
  kind: 'chat',
  mentions: [],
  replyToId: null,
  rootId: 'm1',
  depth: 1,
  delegationId: null,
  createdAt: 1,
  ...overrides,
});

const away: IncomingContext = { myName: 'あなた', focused: false, sinceLastMs: Infinity };
const both: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES, message: 'pop', mention: 'bell' };

describe('mentionsMe', () => {
  it('本文の「@自分の名前」だけを見る（コードブロックの中・名前が空は数えない）', () => {
    expect(mentionsMe(message({ content: '＠あなた 確認お願いします' }), 'あなた')).toBe(true);
    expect(mentionsMe(message({ content: '```\n@あなた\n```' }), 'あなた')).toBe(false);
    expect(mentionsMe(message({ content: '@あなた' }), '')).toBe(false);
  });
});

describe('soundForMessage', () => {
  it('エージェントの返信はふつうの音、自分宛てはメンションの音', () => {
    expect(soundForMessage(message(), both, away)).toBe('pop');
    expect(soundForMessage(message({ content: '@あなた 見てください' }), both, away)).toBe('bell');
    expect(soundForMessage(message({ kind: 'autonomous' }), both, away)).toBe('pop');
  });

  it('既定では自分宛てだけ鳴る', () => {
    expect(soundForMessage(message(), DEFAULT_SOUND_PREFERENCES, away)).toBeNull();
    expect(soundForMessage(message({ content: '@あなた' }), DEFAULT_SOUND_PREFERENCES, away)).toBe('chime');
  });

  it('自分の発言・システムのお知らせ・途中経過・エラーは鳴らさない', () => {
    expect(soundForMessage(message({ authorId: 'me', content: '@あなた' }), both, away)).toBeNull();
    expect(soundForMessage(message({ authorId: 'system' }), both, away)).toBeNull();
    expect(soundForMessage(message({ kind: 'system' }), both, away)).toBeNull();
    expect(soundForMessage(message({ kind: 'progress' }), both, away)).toBeNull();
    expect(soundForMessage(message({ kind: 'error' }), both, away)).toBeNull();
  });

  it('見ているあいだは鳴らさない（「見ていないときだけ」を切れば鳴らす）', () => {
    const focused = { ...away, focused: true };
    expect(soundForMessage(message(), both, focused)).toBeNull();
    expect(soundForMessage(message(), { ...both, onlyWhenUnfocused: false }, focused)).toBe('pop');
  });

  it('自分宛ての音が「なし」ならふつうの音で、両方なし・音量 0 なら鳴らさない', () => {
    const mention = message({ content: '@あなた' });
    expect(soundForMessage(mention, { ...both, mention: 'off' }, away)).toBe('pop');
    expect(soundForMessage(mention, { ...both, mention: 'off', message: 'off' }, away)).toBeNull();
    expect(soundForMessage(mention, { ...both, volume: 0 }, away)).toBeNull();
  });

  it('ふつうの返信は続けて届いても間隔をあけて鳴らし、自分宛ては必ず鳴らす', () => {
    const soon = { ...away, sinceLastMs: MIN_SOUND_GAP_MS - 1 };
    expect(soundForMessage(message(), both, soon)).toBeNull();
    expect(soundForMessage(message(), both, { ...away, sinceLastMs: MIN_SOUND_GAP_MS })).toBe('pop');
    expect(soundForMessage(message({ content: '@あなた' }), both, soon)).toBe('bell');
  });
});
