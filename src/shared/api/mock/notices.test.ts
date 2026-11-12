// Rust（guild-domain の notices と SubtaskNote）と同じ実例で、モックのお知らせの文面が言語ごとに同じになることを検査する。
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@/shared/i18n';
import { behaviorFixture } from '@/shared/lib/behaviorFixtures.test-support';
import type { Language } from '@/shared/types/domain';
import * as notices from './notices';

interface Named {
  name: string;
  text: string;
}
interface Listed {
  names: string[];
  text: string;
}
interface NoticesFixture {
  stopped: string;
  depthLimit: string;
  noResponder: string;
  timedOut: string;
  joined: Named;
  undeliverable: Named;
  didNotAnswer: Named;
  failed: Named;
  unassignable: Listed;
  tooManyTasks: Listed;
  interrupted: Listed;
  subtaskNotes: Record<notices.SubtaskNote, string>;
}

/** 言語のコードごとに同じ形（{ "ja": {...}, "en": {...}, ... }） */
const fixture = behaviorFixture<Record<Language, NoticesFixture>>('notices.json');

describe.each(LANGUAGES.map((option) => option.value))('%s', (language) => {
  const expected = fixture[language];

  it('決まった文面は Rust と同じ', () => {
    const fixed = [notices.stopped, notices.depthLimit, notices.noResponder, notices.timedOut].map((text) =>
      text(language),
    );
    expect(fixed).toEqual([expected.stopped, expected.depthLimit, expected.noResponder, expected.timedOut]);
    for (const [key, text] of Object.entries(expected.subtaskNotes)) {
      expect(notices.subtaskNote(key as notices.SubtaskNote, language)).toBe(text);
    }
  });

  it.each(['joined', 'undeliverable', 'didNotAnswer', 'failed'] as const)('%s の文面は Rust と同じ', (key) => {
    expect(notices[key](expected[key].name, language)).toBe(expected[key].text);
  });

  it.each(['unassignable', 'tooManyTasks', 'interrupted'] as const)('%s の文面は Rust と同じ', (key) => {
    expect(notices[key](expected[key].names, language)).toBe(expected[key].text);
  });
});

it('言語を渡さなければ、いまの言語（テストでは日本語）', () => {
  expect(notices.stopped()).toBe(fixture.ja.stopped);
  expect(notices.joined('ロジカ')).toBe(fixture.ja.joined.text);
});
