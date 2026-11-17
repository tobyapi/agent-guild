// @vitest-environment jsdom
import { useRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Channel } from '@/shared/types/domain';
import { applyChannelsSnapshot, deleteChannel } from '@/features/channels';
import { composerDrafts } from '../draftStore';
import { DRAFT_STORAGE_KEY } from '../draftPersistence';
import { sendMessage } from '../store';
import { useComposer } from './useComposer';
import { useComposerAttachments } from './useComposerAttachments';

const removeChannel = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock('../store', () => ({ sendMessage: vi.fn() }));
vi.mock('@/features/channels/api', () => ({ channelsApi: { remove: removeChannel } }));
const channel = (id: string) => ({ id, name: id, memberIds: [] }) as unknown as Channel;

function Input({ id }: { id: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const files = useComposerAttachments(id);
  const composer = useComposer(
    id,
    [{ agent: { id: 'agent' } as import('@/shared/types/domain').Agent, name: 'Muse', isMember: true }],
    ref,
    files,
  );
  return (
    <>
      <textarea
        aria-label="draft"
        ref={ref}
        value={composer.text}
        onChange={composer.onChange}
        onKeyDown={composer.onKeyDown}
      />
      <button onClick={composer.submit}>send</button>
      <span>{files.attachments.map((file) => file.name).join(',')}</span>
    </>
  );
}

beforeEach(() =>
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
  ),
);
afterEach(() => {
  cleanup();
  composerDrafts.retainChannels([]);
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('restores A after visiting B, retains attachments, and clears only the submitted channel', () => {
  applyChannelsSnapshot([channel('a'), channel('b')]);
  const view = render(<Input key="a" id="a" />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A の下書き' } });
  act(() =>
    composerDrafts.setAttachments('a', () => [
      { key: 'file', name: 'note.txt', data: 'YQ==', size: 1, mediaType: 'text/plain', preview: null },
    ]),
  );
  view.rerender(<Input key="b" id="b" />);
  expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('');
  expect(screen.queryByText('note.txt')).toBeNull();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'B の下書き' } });
  view.rerender(<Input key="a" id="a" />);
  expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('A の下書き');
  expect(screen.getByText('note.txt')).toBeTruthy();
  fireEvent.click(screen.getByText('send'));
  expect(sendMessage).toHaveBeenCalledWith(
    'a',
    'A の下書き',
    expect.arrayContaining([expect.objectContaining({ name: 'note.txt' })]),
  );
  expect(composerDrafts.text('a')).toBe('');
  expect(composerDrafts.attachments('a')).toEqual([]);
  expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!)).toEqual({ b: 'B の下書き' });
});

it('clears deleted channels through the real delete action and snapshot subscription', async () => {
  applyChannelsSnapshot([channel('a'), channel('b')]);
  composerDrafts.setText('a', 'delete');
  composerDrafts.setText('b', 'keep');
  await deleteChannel('a');
  expect(removeChannel).toHaveBeenCalledWith('a');
  expect(composerDrafts.text('a')).toBe('');
  expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!)).toEqual({ b: 'keep' });
});

it('does not submit during IME composition and still inserts a mention at the caret', () => {
  const view = render(<Input key="a" id="a" />);
  const input = screen.getByRole<HTMLTextAreaElement>('textbox');
  fireEvent.change(input, { target: { value: '@Mu', selectionStart: 3 } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
  expect(sendMessage).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Tab' });
  expect(input.value).toBe('@Muse ');
  expect(input.selectionStart).toBe(6);
  view.unmount();
  expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!)).toEqual({ a: '@Muse ' });
});
