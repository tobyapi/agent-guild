// StickerPicker のテスト用の入力欄と準備（StickerPicker.test.tsx / StickerPicker.ime.test.tsx で共有）。
// '../store' のモックは各テストファイルで vi.mock すること
import { useRef } from 'react';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { Agent, Channel } from '@/shared/types/domain';
import { applyChannelsSnapshot } from '@/features/channels';
import { composerDrafts } from '../draftStore';
import { useComposer } from '../hooks/useComposer';
import { useComposerAttachments } from '../hooks/useComposerAttachments';
import { tComposer } from '../i18n/composer';
import { STICKERS } from '../model/stickers';
import { StickerPicker } from './StickerPicker';

const channel = (id: string) => ({ id, name: id, memberIds: [] }) as unknown as Channel;
export const candidates = [{ agent: { id: 'agent' } as Agent, name: 'Muse', isMember: true }];
export const first = () => tComposer(STICKERS[0].key);
export const second = () => tComposer(STICKERS[1].key);

/** 実際の Composer と同じつなぎ方（textarea・スタンプ・添付の表示）だけを持つ入力欄 */
export function Input({ id }: { id: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const files = useComposerAttachments(id);
  const composer = useComposer(id, candidates, ref, files);
  return (
    <form>
      <StickerPicker onInsert={composer.insertSnippet} />
      <textarea
        aria-label="draft"
        ref={ref}
        value={composer.text}
        onChange={composer.onChange}
        onKeyDown={composer.onKeyDown}
        onSelect={composer.onSelect}
        onCompositionStart={composer.onCompositionStart}
        onCompositionEnd={composer.onCompositionEnd}
        onBlur={composer.onBlur}
      />
      <output aria-label="mention">{composer.completion.open ? 'open' : 'closed'}</output>
      <span>{files.attachments.map((file) => file.name).join(',')}</span>
    </form>
  );
}

export const textbox = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'draft' });
export const trigger = () => screen.getByRole('button', { name: tComposer('stickerButton') });
export const items = () => screen.getAllByRole('menuitem');

/** 各テストの前後で、下書きの保存先・チャンネル・モックを用意して片づける */
export function setupStickerTests(): void {
  beforeEach(() => {
    vi.stubGlobal(
      'localStorage',
      (() => {
        const values = new Map<string, string>();
        return {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
          removeItem: (key: string) => values.delete(key),
          clear: () => values.clear(),
        };
      })(),
    );
    applyChannelsSnapshot([channel('a'), channel('b')]);
  });
  afterEach(() => {
    cleanup();
    composerDrafts.retainChannels([]);
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
}
