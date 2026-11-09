import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { BackendInfo } from '@/shared/types/domain';
import { BackendStatus } from './BackendStatus';

vi.mock('../hooks/useRuntime', () => ({ useCheckingBackends: () => false, useLoggingIn: () => null }));
vi.mock('../store', () => ({ loginBackend: vi.fn(), refreshBackends: vi.fn() }));

it('shows the local-only readiness explanation even when a backend is ready', () => {
  const backend = { id: 'grok', status: 'ready', statusMessage: '実験対応・実API未検証。readyは接続成功を意味しない。' } as BackendInfo;
  const markup = renderToStaticMarkup(createElement(BackendStatus, { backend }));
  expect(markup).toContain(backend.statusMessage);
});
