import { setBackendAuthMode } from './auth-mode.ts';

export async function applyBackendAuthMode(
  backend: string,
  mode: 'desktop' | 'api',
  refresh: () => Promise<void>,
): Promise<string> {
  setBackendAuthMode(backend, mode);
  await refresh();
  return '';
}
