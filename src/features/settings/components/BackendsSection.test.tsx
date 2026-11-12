// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useBackends } from '@/features/runtime';
import { backendInfo, NO_SETUP } from '@/shared/lib/backends.test-support';
import { settingsApi } from '../api';
import { useSettingsStore } from '../store';
import { BackendsSection } from './BackendsSection';

vi.mock('@/features/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/runtime')>()),
  useBackends: vi.fn(),
}));
vi.mock('../api', () => ({ settingsApi: { openUrl: vi.fn().mockResolvedValue(null), installBackendCli: vi.fn() } }));

const codex = backendInfo({
  id: 'codex',
  label: 'Codex',
  status: 'unavailable',
  setup: {
    ...NO_SETUP,
    install: {
      cli: 'Codex CLI',
      publisher: 'OpenAI',
      scriptUrl: 'https://chatgpt.com/codex/install.sh',
      shell: '/bin/sh',
      binary: 'codex',
      env: {},
      docsUrl: 'https://learn.chatgpt.com/docs/codex/cli#install-codex',
      loginCommand: 'codex login',
    },
  },
});
const GUIDE = 'Codex CLI のインストール手順';

afterEach(() => {
  cleanup();
  useSettingsStore.setState({ settingUpBackend: null, setupErrors: {} });
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
  const login = { label: 'ChatGPT でログイン', waiting: 'ブラウザーで ChatGPT にログインしてください。' };
  vi.mocked(useBackends).mockReturnValue([{ ...codex, status: 'needs_auth', setup: { ...codex.setup, login } }]);
  view.rerender(<BackendsSection />);
  expect(screen.queryByText(GUIDE)).toBeNull();
  expect(screen.getByText('ログインが必要')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ChatGPT でログイン' })).toBeTruthy();
});

it.each([
  ['claude', 'Claude'],
  ['codex', 'Codex'],
] as const)('Mac の %s はセットアップ中にボタンを無効にし、失敗したらその場でやり直せる', async (id, label) => {
  vi.stubGlobal('navigator', { userAgent: 'Macintosh' });
  vi.mocked(useBackends).mockReturnValue([{ ...codex, id, label }]);
  let rejectInstall!: (reason: Error) => void;
  const pending = new Promise<null>((_resolve, reject) => {
    rejectInstall = reject;
  });
  vi.mocked(settingsApi.installBackendCli).mockReturnValueOnce(pending).mockResolvedValueOnce(null);
  render(<BackendsSection />);
  fireEvent.click(screen.getByRole('button', { name: `${label} をセットアップ` }));
  expect(settingsApi.installBackendCli).toHaveBeenLastCalledWith(id);
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'セットアップ中…' }).disabled).toBe(true);
  await act(async () => {
    rejectInstall(new Error('インターネット接続を確認してください。'));
    await Promise.resolve();
  });
  expect(screen.getByRole('alert').textContent).toContain('インターネット接続');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'もう一度試す' }));
    await Promise.resolve();
  });
  expect(screen.queryByRole('alert')).toBeNull();
});
