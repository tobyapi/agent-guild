// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useBackends } from '@/features/runtime';
import type { BackendInfo } from '@/shared/types/domain';
import { settingsApi } from '../api';
import { BackendsSection } from './BackendsSection';

vi.mock('@/features/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/runtime')>()),
  useBackends: vi.fn(),
}));
vi.mock('../api', () => ({ settingsApi: { openUrl: vi.fn().mockResolvedValue(null) } }));

const codex = { id: 'codex', label: 'Codex', status: 'unavailable', canLogin: false } as BackendInfo;
const GUIDE = 'Codex CLI のインストール手順';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('Codex が使えないとき、公式インストールコマンドを表示・コピーできる', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  vi.mocked(useBackends).mockReturnValue([codex]);
  render(<BackendsSection />);
  fireEvent.click(screen.getByText(GUIDE));
  const command = 'curl -fsSL https://chatgpt.com/codex/install.sh | sh';
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /ターミナルで実行/ }).value).toBe(command);
  fireEvent.click(screen.getByRole('button', { name: 'コマンドをコピー' }));
  expect(writeText).toHaveBeenCalledWith(command);
  fireEvent.click(screen.getByRole('button', { name: /OpenAI の公式手順/ }));
  expect(settingsApi.openUrl).toHaveBeenCalledWith('https://learn.chatgpt.com/docs/codex/cli#install-codex');
  expect(screen.getByRole('button', { name: '再確認' })).toBeTruthy();
});

it('インストール後にログインが必要になったら、インストール手順を閉じる', () => {
  vi.mocked(useBackends).mockReturnValue([codex]);
  const view = render(<BackendsSection />);
  expect(screen.getByText(GUIDE)).toBeTruthy();
  vi.mocked(useBackends).mockReturnValue([{ ...codex, status: 'needs_auth' }]);
  view.rerender(<BackendsSection />);
  expect(screen.queryByText(GUIDE)).toBeNull();
  expect(screen.getByText('ログインが必要')).toBeTruthy();
});
