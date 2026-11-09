// バックエンドのイベントの購読。起動時は「先に全部購読してから」get_boot_status を呼ぶ（design.md §4）。
import { listen } from '@/shared/api';
import type { EventName, EventPayload, Unlisten } from '@/shared/api';

/** すべてのイベントに受け手を要求する（イベントを足して配線を忘れるとコンパイルエラーになる） */
export type BackendEventHandlers = { readonly [E in EventName]: (payload: EventPayload<E>) => void };

export interface Subscription {
  /** すべての購読が済んだら解決する */
  ready: Promise<void>;
  dispose: () => void;
}

export function subscribeBackendEvents(handlers: BackendEventHandlers): Subscription {
  let disposed = false;
  const unlisteners: Unlisten[] = [];
  const keep = (unlisten: Unlisten) => {
    if (disposed) unlisten();
    else unlisteners.push(unlisten);
  };
  const ready = Promise.all([
    listen('message-created', (payload) => handlers['message-created'](payload)).then(keep),
    listen('activity-changed', (payload) => handlers['activity-changed'](payload)).then(keep),
    listen('state-changed', (payload) => handlers['state-changed'](payload)).then(keep),
    listen('skills-changed', (payload) => handlers['skills-changed'](payload)).then(keep),
    listen('skill-library-changed', (payload) => handlers['skill-library-changed'](payload)).then(keep),
    listen('delegation-changed', (payload) => handlers['delegation-changed'](payload)).then(keep),
  ]).then(() => undefined);
  return {
    ready,
    dispose() {
      disposed = true;
      unlisteners.splice(0).forEach((unlisten) => unlisten());
    },
  };
}
