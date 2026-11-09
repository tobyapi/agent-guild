// 型付きクライアント。コマンド名から引数と戻り値の型が決まる: invoke('create_agent', { input })。
import type { CommandArgs, CommandName, CommandResult, EventName, InvokeRest } from './contract';
import { EVENT_VALIDATORS, RESULT_VALIDATORS, warnIfOffContract } from './contractSchemas';
import { ApiError, toCommandError } from './errors';
import type { EventHandler, Transport, Unlisten } from './transport';

let transportPromise: Promise<Transport> | null = null;

function isInsideTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Tauri の中なら IPC、ブラウザなら偽バックエンドを使う（どちらも最初に使うときに読み込む） */
function getTransport(): Promise<Transport> {
  transportPromise ??= isInsideTauri()
    ? import('./tauri').then((module) => module.tauriTransport)
    : import('./mock').then((module) => module.createMockTransport(module.mockOptionsFromLocation()));
  return transportPromise;
}

/**
 * バックエンドのコマンドを呼ぶ。失敗は ApiError（CommandError の code と日本語の message を持つ）で reject する。
 * 開発時は戻り値が契約に合うかも確かめる。
 */
export async function invoke<C extends CommandName>(command: C, ...rest: InvokeRest<C>): Promise<CommandResult<C>> {
  const [args] = rest as [CommandArgs<C>?];
  const transport = await getTransport();
  try {
    const result = await transport.invoke(command, args ?? ({} as CommandArgs<C>));
    if (import.meta.env.DEV) warnIfOffContract(RESULT_VALIDATORS[command], result, command);
    return result;
  } catch (reason) {
    throw new ApiError(toCommandError(reason), { cause: reason });
  }
}

/** バックエンドのイベントを購読する。戻り値の関数で解除する */
export async function listen<E extends EventName>(event: E, handler: EventHandler<E>): Promise<Unlisten> {
  const transport = await getTransport();
  return transport.listen(event, (payload) => {
    if (import.meta.env.DEV) warnIfOffContract(EVENT_VALIDATORS[event], payload, event);
    handler(payload);
  });
}
