import { toErrorEvent } from './dispatcher-errors.ts';
import { manageApiKey } from './credentials/store.ts';
import type { BackendRegistry } from './backends/registry.ts';
import { type BackendAdapter, type RunRequest } from './backends/types.ts';
import type { ParsedLine } from './line-parser.ts';
import { logError } from './log.ts';
import { PROTOCOL_VERSION, type ErrorCode, type RunnerEvent, type RunnerRequest } from './protocol.ts';
import { decodeRequest } from './request-decoder.ts';

type LoginRequest = Extract<RunnerRequest, { type: 'login' }>;
type Work = (signal: AbortSignal, isCurrent: () => boolean) => Promise<string>;

export interface DispatcherOptions {
  registry: BackendRegistry;
  runnerVersion: string;
  send: (event: RunnerEvent) => void;
  /** shutdown を処理し終えたら呼ばれる（プロセスを終わらせる） */
  exit: () => void;
}

export class Dispatcher {
  readonly #options: DispatcherOptions;
  /** 実行中のジョブ。終端イベントを送ったら消す */
  readonly #jobs = new Map<string, AbortController>();
  #closed = false;

  constructor(options: DispatcherOptions) {
    this.#options = options;
  }

  /** 起動直後に1回だけ送る握手（各バックエンドの状態を確かめてから送る） */
  async announce(): Promise<void> {
    const { registry, runnerVersion, send } = this.#options;
    const backends = await registry.describe();
    send({ type: 'ready', protocolVersion: PROTOCOL_VERSION, runnerVersion, backends });
  }

  receive(line: ParsedLine): void {
    if (this.#closed || line.kind === 'empty') return;
    if (line.kind === 'malformed') {
      this.#fail(null, 'bad_request', line.reason);
      return;
    }
    const decoded = decodeRequest(line.value);
    if (decoded.ok) this.#handle(decoded.request);
    else if (decoded.id !== null) this.#fail(decoded.id, 'bad_request', decoded.message);
    else logError(`不正な要求を無視しました: ${decoded.message}`);
  }

  /** 実行中のジョブを中断して cancelled を返す。存在しなければ何もしない（既に終わったジョブなど） */
  cancel(id: string): void {
    const controller = this.#jobs.get(id);
    if (!controller) return;
    this.#jobs.delete(id);
    controller.abort();
    this.#fail(id, 'cancelled', '実行を中断しました');
  }

  /** 実行中のジョブをすべて中断して終わる。以後の入力は無視する */
  shutdown(): void {
    if (this.#closed) return;
    for (const id of [...this.#jobs.keys()]) this.cancel(id);
    this.#closed = true;
    this.#options.exit();
  }

  #handle(request: RunnerRequest): void {
    if (request.type === 'run') this.#run(request);
    else if (request.type === 'apiKey') {
      if (!this.#claim(request.id, request.backend)) return;
      this.#track(request.id, async () => {
        const status = await manageApiKey(request.backend, request.action, request.key);
        await this.#probe();
        return status;
      });
    } else if (request.type === 'login') this.#login(request);
    else if (request.type === 'cancel') this.cancel(request.id);
    else if (request.type === 'probe') void this.#probe();
    else this.shutdown();
  }

  /** 状態を確かめ直して backends を送る（失敗しても記録だけ） */
  async #probe(): Promise<void> {
    try {
      const backends = await this.#options.registry.describe();
      if (!this.#closed) this.#options.send({ type: 'backends', backends });
    } catch (error) {
      logError('バックエンドの状態を確認できませんでした', error);
    }
  }

  #run(request: RunRequest): void {
    const { id } = request;
    const adapter = this.#claim(id, request.backend);
    if (!adapter) return;
    this.#track(id, (signal, isCurrent) => {
      // 途中経過と途中の投稿は、終端イベントを送るまでのあいだだけ送る
      const send = (event: RunnerEvent): void => {
        if (isCurrent()) this.#options.send(event);
      };
      return adapter.run(request, {
        signal,
        onActivity: (detail) => send({ type: 'activity', id, detail }),
        onPost: (text) => send({ type: 'post', id, text }),
      });
    });
  }

  /** ログインが終わったら（成否にかかわらず）状態を確かめ直してから終端イベントを送る */
  #login({ id, backend }: LoginRequest): void {
    const adapter = this.#claim(id, backend);
    if (!adapter) return;
    const { login } = adapter;
    if (!login || !adapter.info().canLogin) {
      this.#fail(id, 'bad_request', `${adapter.info().label} はアプリからログインできません`);
      return;
    }
    this.#track(id, async (signal) => {
      try {
        await login({ signal });
        return '';
      } finally {
        await this.#probe();
      }
    });
  }

  /** id が空いていて backend が既知なら、そのアダプタ。そうでなければ error を返して undefined */
  #claim(id: string, backend: string): BackendAdapter | undefined {
    if (this.#jobs.has(id)) {
      this.#fail(id, 'bad_request', `同じ id のジョブが実行中です: ${id}`);
      return undefined;
    }
    const adapter = this.#options.registry.find(backend);
    if (!adapter) this.#fail(id, 'unknown_backend', `未知のバックエンドです: ${backend}`);
    return adapter;
  }

  #track(id: string, work: Work): void {
    const controller = new AbortController();
    this.#jobs.set(id, controller);
    this.#settle(id, controller, work).catch((error: unknown) => {
      logError(`ジョブ ${id} の応答を送れませんでした`, error);
    });
  }

  async #settle(id: string, controller: AbortController, work: Work): Promise<void> {
    const isCurrent = (): boolean => this.#jobs.get(id) === controller;
    let event: RunnerEvent | undefined;
    try {
      event = { type: 'result', id, text: await work(controller.signal, isCurrent) };
    } catch (error) {
      // cancel 済みなら中断による失敗なので記録しない
      event = isCurrent() ? toErrorEvent(id, error) : undefined;
    }
    // cancel 済みなら終端イベント（cancelled）は送ってあるので、遅れて届いた結果は捨てる
    if (event === undefined || !isCurrent()) return;
    this.#jobs.delete(id);
    this.#options.send(event);
  }

  #fail(id: string | null, code: ErrorCode, message: string): void {
    this.#options.send({ type: 'error', id, code, message });
  }
}
