import type { EventName, EventPayload } from '../contract';
import type { EventHandler, Unlisten } from '../transport';

export interface MockEventBus {
  emit<E extends EventName>(event: E, payload: EventPayload<E>): void;
  on<E extends EventName>(event: E, handler: EventHandler<E>): Unlisten;
}

/**
 * 偽バックエンドのイベント配信。Tauri と同じく非同期に届け、
 * 受け手が持つ値と内部状態を共有しないようにペイロードを複製して渡す。
 */
export function createMockEventBus(defer: (task: () => void) => void): MockEventBus {
  const handlers = new Map<EventName, Set<(payload: never) => void>>();
  return {
    emit(event, payload) {
      const copy = structuredClone(payload);
      defer(() => {
        handlers.get(event)?.forEach((handler) => handler(copy as never));
      });
    },
    on(event, handler) {
      const set = handlers.get(event) ?? new Set();
      handlers.set(event, set);
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },
  };
}
