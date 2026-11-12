// お知らせのアイコンが、Rust の文面（contracts/behavior/notices.json）を言語によらず見分けることを検査する。
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@/shared/i18n';
import { behaviorFixture } from '@/shared/lib/behaviorFixtures.test-support';
import type { Language } from '@/shared/types/domain';
import { noticeIcon, splitLeadingName } from './systemNotice';

interface NoticesFixture {
  stopped: string;
  depthLimit: string;
  noResponder: string;
  joined: { name: string; text: string };
}

const fixture = behaviorFixture<Record<Language, NoticesFixture>>('notices.json');

describe('noticeIcon', () => {
  it.each(LANGUAGES.map((option) => option.value))('%s のお知らせを見分ける', (language) => {
    const notices = fixture[language];
    expect(noticeIcon(notices.joined.text)).toBe('join');
    expect(noticeIcon(notices.stopped)).toBe('stop');
    expect(noticeIcon(notices.depthLimit)).toBe('limit');
    expect(noticeIcon(notices.noResponder)).toBe('other');
    expect(splitLeadingName(notices.joined.text, [notices.joined.name])?.name).toBe(notices.joined.name);
  });
});
