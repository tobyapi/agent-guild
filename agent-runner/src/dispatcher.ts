import { DispatcherJobs } from './dispatcher-jobs.ts';
import { apiKeyWork } from './dispatcher-api-key.ts';
import { applyBackendAuthMode } from './backends/auth-mode-request.ts';
import type { BackendRegistry } from './backends/registry.ts';
import {
  DEFAULT_RUN_TIMEOUT_MINUTES,
  usableRequest,
  type BackendAdapter,
  type ImageRequest,
  type RunRequest,
} from './backends/types.ts';
import type { ParsedLine } from './line-parser.ts';
import { setLanguage } from './i18n.ts';
import { logError } from './log.ts';
import { OperationApprovals } from './operation-approvals.ts';
import type { ApprovalResponse } from './protocol-approval.ts';
import { PROTOCOL_VERSION, type ErrorCode, type RunnerEvent, type RunnerRequest } from './protocol.ts';
import { decodeRequest } from './request-decoder.ts';
import { t } from './texts/index.ts';
import { runContext } from './dispatcher-run-context.ts';
import { prepareRunWorkspace } from './dispatcher-workspace.ts';
import { BackgroundJobs } from './backgrounds/jobs.ts';
import { themeWork } from './themes/codex.ts';

export interface DispatcherOptions {
  registry: BackendRegistry;
  runnerVersion: string;
  send: (event: RunnerEvent) => void;
  /** shutdown を処理し終えたら呼ばれる（プロセスを終わらせる） */
  exit: () => void;
}

export class Dispatcher {
  readonly #options: DispatcherOptions;
  readonly #jobs: DispatcherJobs;
  readonly #approvals: OperationApprovals;
  #closed = false;
  readonly #backgrounds: BackgroundJobs;
  constructor(options: DispatcherOptions) {
    this.#options = options;
    this.#approvals = new OperationApprovals(options.send);
    this.#jobs = new DispatcherJobs(options.send);
    this.#backgrounds = new BackgroundJobs(options.registry, options.send);
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
    if (decoded.ok) {
      if (decoded.request.type === 'approvalResponse') this.#approvals.respond(decoded.request);
      else this.#handle(decoded.request);
    } else if (decoded.id !== null) this.#fail(decoded.id, 'bad_request', decoded.message);
    else logError(`不正な要求を無視しました: ${decoded.message}`);
  }

  /** 実行中のジョブに中断を要求する。該当するジョブがなければ何もしない */
  cancel(id: string): void {
    this.#backgrounds.cancel(id);
    this.#jobs.cancel(id);
  }

  /** 実行中のジョブをすべて中断して終わる。以後の入力は無視する */
  shutdown(): void {
    if (this.#closed) return;
    this.#backgrounds.shutdown();
    this.#jobs.cancelAll();
    this.#closed = true;
    this.#options.exit();
  }

  #handle(request: Exclude<RunnerRequest, ApprovalResponse>): void {
    if (request.type === 'theme') this.#jobs.start(request.id, themeWork(this.#options.registry, request));
    else if (request.type === 'background') this.#backgrounds.start(request);
    else if (request.type === 'backgroundCancel') this.#backgrounds.cancel(request.id);
    else if (request.type === 'run') this.#run(request);
    else if (request.type === 'image') this.#image(request);
    else if (request.type === 'apiKey') this.#apiKey(request);
    else if (request.type === 'backendAuthMode') {
      this.#jobs.start(request.id, () =>
        applyBackendAuthMode(request.backend, request.mode, () => this.#refreshBackends()),
      );
    } else if (request.type === 'login') this.#login(request);
    else if (request.type === 'cancel') this.cancel(request.id);
    else if (request.type === 'setLanguage') {
      // 返事はない。BackendInfo の説明（状態の説明は確かめた時点の言語で作る）を新しい言語で送り直す
      setLanguage(request.language);
      void this.#probe();
    } else if (request.type === 'probe') {
      this.#probeRequest(request.id);
    } else this.shutdown();
  }

  #probeRequest(id: string) {
    if (this.#jobs.has(id)) {
      this.#fail(id, 'bad_request', 'Duplicate probe id');
      return;
    }
    this.#jobs.start(id, async () => {
      await this.#refreshBackends();
      return '';
    });
  }

  #apiKey(request: Extract<RunnerRequest, { type: 'apiKey' }>): void {
    const info = this.#claim(request.id, request.backend)?.info();
    if (!info) return;
    const work = apiKeyWork(request, info, () => this.#probe(), this.#options.send);
    if (work) this.#jobs.start(request.id, work);
  }

  async #probe(): Promise<void> {
    try {
      await this.#refreshBackends();
    } catch (error) {
      logError('バックエンドの状態を確認できませんでした', error);
    }
  }

  async #refreshBackends(): Promise<void> {
    const backends = await this.#options.registry.describe();
    if (!this.#closed) this.#options.send({ type: 'backends', backends });
  }

  #run(request: RunRequest): void {
    const { id } = request;
    const adapter = this.#claim(id, request.backend);
    if (!adapter) return;
    const minutes = adapter.runTimeoutMinutes?.(request.options) ?? DEFAULT_RUN_TIMEOUT_MINUTES;
    this.#jobs.start(
      id,
      async (signal, isCurrent, budget) => {
        if (request.prepareWorkspace) {
          await prepareRunWorkspace(request, signal);
          signal.throwIfAborted();
        }
        const context = runContext(id, signal, isCurrent, this.#options.send, this.#approvals, budget);
        try {
          return await adapter.run(usableRequest(request, adapter.info()), context);
        } finally {
          this.#approvals.cancelRun(id);
        }
      },
      { workspace: request.workspace, timeoutMinutes: minutes, prepareWorkspace: request.prepareWorkspace },
    );
  }

  /** 画像を描く（枠の生成を申告して image を持つアダプタだけ）。PNG を output に書いたら result（text は空） */
  #image(request: ImageRequest): void {
    const { id } = request;
    const adapter = this.#claim(id, request.backend);
    if (!adapter) return;
    const { image } = adapter;
    if (!image || !adapter.info().frameGeneration) {
      this.#fail(id, 'bad_request', t('noImage', { backend: adapter.info().label }));
      return;
    }
    this.#jobs.start(id, async (signal, isCurrent) => {
      const onActivity = (detail: string): void => {
        if (isCurrent()) this.#options.send({ type: 'activity', id, detail });
      };
      await image(request, { signal, onActivity });
      return '';
    });
  }

  /** ログインが終わったら（成否にかかわらず）状態を確かめ直してから終端イベントを送る */
  #login({ id, backend }: Extract<RunnerRequest, { type: 'login' }>): void {
    const adapter = this.#claim(id, backend);
    if (!adapter) return;
    const { login } = adapter;
    if (!login || adapter.info().setup.login === null) {
      this.#fail(id, 'bad_request', t('noLogin', { backend: adapter.info().label }));
      return;
    }
    this.#jobs.start(id, async (signal) => {
      try {
        await login({ signal });
        return '';
      } finally {
        await this.#probe();
      }
    });
  }

  /** 登録済みのアダプタを返す。未知のバックエンドには error を返す */
  #claim(id: string, backend: string): BackendAdapter | undefined {
    const adapter = this.#options.registry.find(backend);
    if (!adapter) this.#fail(id, 'unknown_backend', t('unknownBackend', { backend }));
    return adapter;
  }

  #fail(id: string | null, code: ErrorCode, message: string): void {
    this.#options.send({ type: 'error', id, code, message });
  }
}
