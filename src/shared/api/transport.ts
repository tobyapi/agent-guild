import type { CommandArgs, CommandName, CommandResult, EventName, EventPayload } from './contract';

export type Unlisten = () => void;
export type EventHandler<E extends EventName> = (payload: EventPayload<E>) => void;

/**
 * バックエンドとの通信路。Tauri の IPC（tauri.ts）とブラウザ用の偽バックエンド（mock/）を差し替える。
 * 失敗は reject で返す（Tauri は日本語の文字列、モックは Error）。
 */
export interface Transport {
  invoke<C extends CommandName>(command: C, args: CommandArgs<C>): Promise<CommandResult<C>>;
  listen<E extends EventName>(event: E, handler: EventHandler<E>): Promise<Unlisten>;
}
