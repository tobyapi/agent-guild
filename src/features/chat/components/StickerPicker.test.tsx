// @vitest-environment jsdom
import { useRef } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Agent, Channel } from '@/shared/types/domain';
import { applyChannelsSnapshot } from '@/features/channels';
import { composerDrafts } from '../draftStore';
import { DRAFT_STORAGE_KEY } from '../draftPersistence';
import { useComposer } from '../hooks/useComposer';
import { useComposerAttachments } from '../hooks/useComposerAttachments';
import { tComposer } from '../i18n/composer';
import { STICKERS } from '../model/stickers';
import { StickerPicker } from './StickerPicker';

vi.mock('../store', () => ({ sendMessage: vi.fn() }));
const channel = (id: string) => ({ id, name: id, memberIds: [] }) as unknown as Channel;
const candidates = [{ agent: { id: 'agent' } as Agent, name: 'Muse', isMember: true }];
const first = () => tComposer(STICKERS[0].key);
const second = () => tComposer(STICKERS[1].key);

/** 実際の Composer と同じつなぎ方（textarea・スタンプ・添付の表示）だけを持つ入力欄 */
function Input({ id }: { id: string }) {
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
      />
      <output aria-label="mention">{composer.completion.open ? 'open' : 'closed'}</output>
      <span>{files.attachments.map((file) => file.name).join(',')}</span>
    </form>
  );
}

const textbox = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'draft' });
const trigger = () => screen.getByRole('button', { name: tComposer('stickerButton') });
const items = () => screen.getAllByRole('menuitem');

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

it('inserts the chosen sticker at the caret, keeps attachments, returns focus and saves the draft', () => {
  const view = render(<Input id="a" />);
  const input = textbox();
  fireEvent.change(input, { target: { value: '前半。後半。' } });
  act(() =>
    composerDrafts.setAttachments('a', () => [
      { key: 'file', name: 'note.txt', data: 'YQ==', size: 1, mediaType: 'text/plain', preview: null },
    ]),
  );
  input.setSelectionRange(3, 3);
  fireEvent.click(trigger());
  expect(trigger().getAttribute('aria-expanded')).toBe('true');
  expect(items()).toHaveLength(STICKERS.length);
  fireEvent.click(items()[0]!);

  expect(input.value).toBe(`前半。${first()}後半。`);
  expect(input.selectionStart).toBe(3 + first().length);
  expect(document.activeElement).toBe(input);
  expect(screen.queryByRole('menu')).toBeNull();
  expect(screen.getByText('note.txt')).toBeTruthy();
  view.unmount();
  expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!)).toEqual({ a: `前半。${first()}後半。` });
});

it('replaces the selected text and keeps other channels’ drafts untouched', () => {
  composerDrafts.setText('b', 'B の下書き');
  render(<Input id="a" />);
  const input = textbox();
  fireEvent.change(input, { target: { value: 'abcdef' } });
  input.setSelectionRange(1, 4);
  fireEvent.click(trigger());
  fireEvent.click(items()[1]!);
  expect(input.value).toBe(`a${second()}ef`);
  expect(composerDrafts.text('b')).toBe('B の下書き');
});

it('opens, moves, picks and closes with the keyboard only', () => {
  render(<Input id="a" />);
  const input = textbox();
  fireEvent.change(input, { target: { value: 'x' } });
  trigger().focus();
  fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(items()[0]);

  fireEvent.keyDown(items()[0]!, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(items()[1]);
  fireEvent.keyDown(items()[1]!, { key: 'End' });
  expect(document.activeElement).toBe(items()[STICKERS.length - 1]);
  fireEvent.keyDown(items()[STICKERS.length - 1]!, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(items()[0]);
  fireEvent.keyDown(items()[0]!, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(items()[STICKERS.length - 1]);
  fireEvent.keyDown(items()[STICKERS.length - 1]!, { key: 'Home' });
  expect(document.activeElement).toBe(items()[0]);

  // Esc で閉じてボタンへ戻る（下書きは変わらない）
  fireEvent.keyDown(items()[0]!, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(trigger());
  expect(input.value).toBe('x');

  // もう一度開いて 2 件目を選ぶ（Enter・Space はボタンの click になる）
  fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
  fireEvent.keyDown(items()[0]!, { key: 'ArrowDown' });
  fireEvent.click(document.activeElement!);
  expect(input.value).toBe(`x${second()}`);
  expect(document.activeElement).toBe(input);
  expect(screen.queryByRole('menu')).toBeNull();
});

it('closes when the user clicks outside without changing the draft', () => {
  render(<Input id="a" />);
  fireEvent.click(trigger());
  expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.mouseDown(textbox());
  expect(screen.queryByRole('menu')).toBeNull();
  expect(textbox().value).toBe('');
});

it('waits for IME composition to finish before inserting, so the composed text is not broken', () => {
  render(<Input id="a" />);
  const input = textbox();
  fireEvent.change(input, { target: { value: 'こんにちは' } });
  fireEvent.compositionStart(input);
  fireEvent.change(input, { target: { value: 'こんにちはせかい' } });
  fireEvent.click(trigger());
  fireEvent.click(items()[0]!);
  // 変換中は差し込まない
  expect(input.value).toBe('こんにちはせかい');

  // 確定（確定の input より先に compositionend が来ても、確定後の値に対して差し込む）
  input.value = 'こんにちは世界';
  input.setSelectionRange(7, 7);
  fireEvent.compositionEnd(input);
  expect(input.value).toBe(`こんにちは世界${first()}`);
  expect(composerDrafts.text('a')).toBe(`こんにちは世界${first()}`);
  expect(input.selectionStart).toBe(7 + first().length);
});

it('keeps mention completion working after a sticker is inserted', () => {
  render(<Input id="a" />);
  const input = textbox();
  fireEvent.click(trigger());
  fireEvent.click(items()[0]!);
  const value = `${input.value} @Mu`;
  fireEvent.change(input, { target: { value, selectionStart: value.length } });
  expect(screen.getByRole('status', { name: 'mention' }).textContent).toBe('open');
  fireEvent.keyDown(input, { key: 'Tab' });
  expect(input.value).toBe(`${first()} @Muse `);
});

it('keeps insertSnippet stable across keystrokes so the memoized picker does not re-render while typing', () => {
  const { result, rerender } = renderHook(
    ({ id }) => {
      const ref = useRef<HTMLTextAreaElement>(null);
      return useComposer(id, candidates, ref, { attachments: [], clear: () => {} });
    },
    { initialProps: { id: 'a' } },
  );
  const before = result.current.insertSnippet;
  act(() => composerDrafts.setText('a', 'typing...'));
  rerender({ id: 'a' });
  expect(result.current.text).toBe('typing...');
  expect(result.current.insertSnippet).toBe(before);
});
