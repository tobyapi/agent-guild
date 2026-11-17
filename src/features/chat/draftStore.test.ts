// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDraftStore } from './draftStore';
import { DRAFT_STORAGE_KEY } from './draftPersistence';

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
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps channels separate and batches writes within 500ms', () => {
  const drafts = createDraftStore();
  const write = vi.spyOn(localStorage, 'setItem');
  drafts.setText('a', 'first');
  drafts.setText('a', '日本語の下書き');
  drafts.setText('b', 'second');
  expect(drafts.text('a')).toBe('日本語の下書き');
  expect(drafts.text('b')).toBe('second');
  expect(write).not.toHaveBeenCalled();
  vi.advanceTimersByTime(500);
  expect(write).toHaveBeenCalledTimes(1);
  expect(createDraftStore().text('a')).toBe('日本語の下書き');
  write.mockRestore();
});

it('removes empty drafts immediately, including the last storage entry', () => {
  const drafts = createDraftStore();
  drafts.setText('a', 'draft');
  drafts.flush();
  drafts.setText('a', '');
  expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  vi.advanceTimersByTime(500);
  expect(createDraftStore().text('a')).toBe('');
});

it('prunes deleted channels from disk and memory and cancels their pending reads', () => {
  const drafts = createDraftStore();
  drafts.setText('a', 'keep');
  drafts.setText('b', 'delete');
  const current = drafts.beginAttachmentRead('b');
  drafts.retainChannels(['a']);
  expect(current()).toBe(false);
  expect(drafts.text('b')).toBe('');
  expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)!)).toEqual({ a: 'keep' });
  expect(createDraftStore().text('b')).toBe('');
});

it('loads only string drafts and recovers from malformed or inaccessible storage', () => {
  localStorage.setItem(DRAFT_STORAGE_KEY, '{"a":"text","b":1,"c":""}');
  expect(createDraftStore().store.getState().texts).toEqual({ a: 'text' });
  localStorage.setItem(DRAFT_STORAGE_KEY, 'broken');
  expect(createDraftStore().text('a')).toBe('');
  const read = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const drafts = createDraftStore();
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  drafts.setText('a', 'in memory');
  drafts.flush();
  expect(drafts.text('a')).toBe('in memory');
  expect(warn).toHaveBeenCalledOnce();
  read.mockRestore();
  write.mockRestore();
  warn.mockRestore();
});

it('never persists attachments and invalidates reads on send or deletion', () => {
  const drafts = createDraftStore();
  drafts.setText('a', 'text only');
  drafts.setAttachments('a', () => [
    { key: 'one', name: 'private.txt', data: 'YQ==', size: 1, mediaType: 'text/plain', preview: null },
  ]);
  drafts.flush();
  expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe('{"a":"text only"}');
  expect(createDraftStore().attachments('a')).toEqual([]);
  const beforeSend = drafts.beginAttachmentRead('a');
  drafts.clearAttachments('a');
  expect(beforeSend()).toBe(false);
  const beforeDelete = drafts.beginAttachmentRead('a');
  drafts.setAttachments('a', () => [
    { key: 'two', name: 'private.txt', data: 'YQ==', size: 1, mediaType: 'text/plain', preview: null },
  ]);
  drafts.retainChannels([]);
  expect(beforeDelete()).toBe(false);
  expect(drafts.attachments('a')).toEqual([]);
});
