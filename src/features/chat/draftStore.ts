// Persist text only; attachments stay in memory for this app session.
import { createStore } from 'zustand/vanilla';
import { useChannelsStore } from '@/features/channels';
import type { PendingAttachment } from './model/pendingAttachments';
import { loadDraftTexts, saveDraftTexts } from './draftPersistence';

interface DraftState {
  texts: Record<string, string>;
  files: Record<string, PendingAttachment[]>;
}

const EMPTY_ATTACHMENTS: PendingAttachment[] = [];

export function createDraftStore() {
  const store = createStore<DraftState>(() => ({ texts: loadDraftTexts(), files: {} }));
  const readTokens = new Map<string, symbol>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    saveDraftTexts(store.getState().texts);
  };
  const schedule = () => {
    timer ??= setTimeout(flush, 500);
  };
  return {
    store,
    flush,
    text: (id: string) => store.getState().texts[id] ?? '',
    attachments: (id: string) => store.getState().files[id] ?? EMPTY_ATTACHMENTS,
    setText(id: string, text: string) {
      const texts = { ...store.getState().texts };
      if (text === '') delete texts[id];
      else texts[id] = text;
      store.setState({ texts });
      schedule();
      if (text === '') flush();
    },
    setAttachments(id: string, update: (current: PendingAttachment[]) => PendingAttachment[]) {
      const files = { ...store.getState().files };
      const next = update(files[id] ?? EMPTY_ATTACHMENTS);
      if (next.length === 0) delete files[id];
      else files[id] = next;
      store.setState({ files });
    },
    clearAttachments(id: string) {
      readTokens.delete(id);
      const files = { ...store.getState().files };
      delete files[id];
      store.setState({ files });
    },
    retainChannels(ids: readonly string[]) {
      const keep = new Set(ids);
      const { texts, files } = store.getState();
      const removed = new Set(
        [...Object.keys(texts), ...Object.keys(files), ...readTokens.keys()].filter((id) => !keep.has(id)),
      );
      if (removed.size === 0) return;
      removed.forEach((id) => readTokens.delete(id));
      store.setState({
        texts: Object.fromEntries(Object.entries(texts).filter(([id]) => keep.has(id))),
        files: Object.fromEntries(Object.entries(files).filter(([id]) => keep.has(id))),
      });
      schedule();
      flush();
    },
    beginAttachmentRead(id: string) {
      const started = readTokens.get(id) ?? Symbol();
      readTokens.set(id, started);
      return () => readTokens.get(id) === started;
    },
  };
}

export const composerDrafts = createDraftStore();
useChannelsStore.subscribe((state, previous) => {
  if (state.channels !== previous.channels) composerDrafts.retainChannels(state.channels.map((channel) => channel.id));
});
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', composerDrafts.flush);
  window.addEventListener('pagehide', composerDrafts.flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') composerDrafts.flush();
  });
}
