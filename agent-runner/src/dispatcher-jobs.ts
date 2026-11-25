import { JobTimeBudget } from './job-time-budget.ts';
import { resolve } from 'node:path';
import { toErrorEvent } from './dispatcher-errors.ts';
import { logError } from './log.ts';
import type { RunnerEvent } from './protocol.ts';
import { t } from './texts/index.ts';

type Work = (signal: AbortSignal, isCurrent: () => boolean, budget?: JobTimeBudget) => Promise<string>;
type Interruption = Extract<RunnerEvent, { type: 'error' }>;
type JobOptions = { workspace: string; timeoutMinutes?: number; prepareWorkspace?: boolean };
type ActiveJob = {
  controller: AbortController;
  workspace?: string;
  preparesWorkspace?: boolean;
  budget?: JobTimeBudget;
  timer?: ReturnType<typeof setTimeout>;
  interruption?: Interruption;
  notified?: boolean;
};

const CLEANUP_GRACE_MS = 5_000;

export class DispatcherJobs {
  readonly #active = new Map<string, ActiveJob>();
  readonly #send: (event: RunnerEvent) => void;

  constructor(send: (event: RunnerEvent) => void) {
    this.#send = send;
  }

  has(id: string): boolean {
    return this.#active.has(id);
  }

  start(id: string, work: Work, options?: JobOptions): void {
    if (this.has(id)) {
      this.#send({ type: 'error', id, code: 'bad_request', message: t('duplicateJob', { id }) });
      return;
    }
    const job: ActiveJob = { controller: new AbortController() };
    if (options) {
      const workspace = resolve(options.workspace);
      job.workspace = process.platform === 'win32' ? workspace.toLowerCase() : workspace;
      job.preparesWorkspace = options.prepareWorkspace;
      for (const active of this.#active.values()) {
        if (active.workspace !== job.workspace) continue;
        // 管理領域を作り直す依頼は実行全体を通して排他にする。
        if (!job.preparesWorkspace && !active.preparesWorkspace && !active.interruption) continue;
        this.#send({ type: 'error', id, code: 'bad_request', message: t('workspaceBusy') });
        return;
      }
    }
    this.#active.set(id, job);
    const timeoutMinutes = options?.timeoutMinutes;
    if (timeoutMinutes !== undefined) {
      job.budget = new JobTimeBudget(timeoutMinutes, () => {
        this.#interrupt(id, job, 'timeout', t('runTimedOut', { minutes: timeoutMinutes }));
      });
    }
    this.#settle(id, job, work).catch((error: unknown) => {
      logError(`ジョブ ${id} の応答を送れませんでした`, error);
    });
  }

  cancel(id: string): void {
    const job = this.#active.get(id);
    if (job) this.#interrupt(id, job, 'cancelled', t('cancelled'));
  }

  cancelAll(): void {
    // ランナーの終了時は、後続のジョブを受け付けないので終端を送ってから抜ける。
    for (const [id, job] of this.#active) {
      const event = this.#interrupt(id, job, 'cancelled', t('cancelled'));
      if (this.#finish(id, job)) this.#notify(job, event);
    }
  }

  #interrupt(id: string, job: ActiveJob, code: 'cancelled' | 'timeout', message: string): Interruption {
    if (job.interruption) return job.interruption;
    const event = { type: 'error', id, code, message } as const;
    job.interruption = event;
    job.budget?.stop();
    if (job.workspace !== undefined) {
      // 終端を先に送っても、後処理が終わるまで作業場所の予約を残す。
      job.timer = setTimeout(() => this.#notify(job, event), CLEANUP_GRACE_MS).unref();
    }
    job.controller.abort();
    return event;
  }

  async #settle(id: string, job: ActiveJob, work: Work): Promise<void> {
    const isCurrent = (): boolean => this.#active.get(id) === job && job.interruption === undefined;
    let event: RunnerEvent;
    try {
      event = { type: 'result', id, text: await work(job.controller.signal, isCurrent, job.budget) };
    } catch (error) {
      event = job.interruption ?? toErrorEvent(id, error);
    }
    // 終端を先に送っていた場合も、ここで作業場所の予約を解除する。
    if (this.#finish(id, job)) this.#notify(job, job.interruption ?? event);
  }

  #notify(job: ActiveJob, event: RunnerEvent): void {
    if (job.notified) return;
    job.notified = true;
    this.#send(event);
  }

  #finish(id: string, job: ActiveJob): boolean {
    if (this.#active.get(id) !== job) return false;
    this.#active.delete(id);
    job.budget?.stop();
    clearTimeout(job.timer);
    return true;
  }
}
