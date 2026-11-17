import type { BackendRegistry } from '../backends/registry.ts';
import { BackendError } from '../backends/types.ts';
import { toErrorEvent } from '../dispatcher-errors.ts';
import type { RunnerEvent, RunnerRequest } from '../protocol.ts';

/** Background jobs retain ownership until their renderer has stopped and cleaned up. */
export class BackgroundJobs {
  readonly #running = new Map<string, AbortController>();
  readonly registry: BackendRegistry;
  readonly send: (event: RunnerEvent) => void;
  constructor(registry: BackendRegistry, send: (event: RunnerEvent) => void) {
    this.registry = registry;
    this.send = send;
  }

  start(request: Extract<RunnerRequest, { type: 'background' }>): void {
    if (this.#running.size) {
      this.send({ type: 'error', id: request.id, code: 'bad_request', message: 'Background renderer is busy' });
      return;
    }
    const controller = new AbortController();
    this.#running.set(request.id, controller);
    void this.#render(request, controller);
  }

  cancel(id: string): void {
    this.#running.get(id)?.abort();
  }

  shutdown(): void {
    for (const controller of this.#running.values()) controller.abort();
  }

  async #render(request: Extract<RunnerRequest, { type: 'background' }>, controller: AbortController): Promise<void> {
    let event: RunnerEvent;
    try {
      const adapter = this.registry.find(request.backend);
      if (
        !adapter?.background ||
        (await adapter.backgroundReady?.()) === false ||
        (await adapter.probe()).status !== 'ready'
      ) {
        throw new BackendError('bad_request', 'Background generation is unavailable');
      }
      controller.signal.throwIfAborted();
      const bytes = await adapter.background(request.prompt, controller.signal);
      controller.signal.throwIfAborted();
      if (!bytes.length || bytes.length > 5 * 1024 * 1024)
        throw new BackendError('invalid_response', 'Background exceeds 5 MiB or is empty');
      event = { type: 'result', id: request.id, text: Buffer.from(bytes).toString('base64') };
    } catch (error) {
      event = controller.signal.aborted
        ? { type: 'error', id: request.id, code: 'cancelled', message: 'Background generation cancelled' }
        : toErrorEvent(request.id, error);
    }
    this.#running.delete(request.id);
    this.send(event);
  }
}
