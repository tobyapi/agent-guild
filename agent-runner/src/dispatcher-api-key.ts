import { manageApiKey } from './credentials/store.ts';
import type { BackendDescriptor } from './backends/types.ts';
import type { RunnerEvent, RunnerRequest } from './protocol.ts';
import { t } from './texts/index.ts';

export function apiKeyWork(
  request: Extract<RunnerRequest, { type: 'apiKey' }>,
  info: BackendDescriptor,
  refresh: () => Promise<void>,
  reject: (event: RunnerEvent) => void,
): (() => Promise<string>) | undefined {
  const spec = info.setup.apiKey;
  if (spec === null) {
    reject({ type: 'error', id: request.id, code: 'bad_request', message: t('noApiKey', { backend: info.label }) });
    return;
  }
  return async () => {
    const status = await manageApiKey(request.backend, spec.envVar, request.action, request.key);
    await refresh();
    return status;
  };
}
