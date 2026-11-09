import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { EventName, EventPayload } from './contract';
import type { EventHandler, Transport } from './transport';

/** Tauri の IPC を使う通信路（デスクトップアプリの中で使う） */
export const tauriTransport: Transport = {
  invoke: (command, args) => invoke(command, args),
  listen: <E extends EventName>(event: E, handler: EventHandler<E>) =>
    listen<EventPayload<E>>(event, (tauriEvent) => handler(tauriEvent.payload)),
};
