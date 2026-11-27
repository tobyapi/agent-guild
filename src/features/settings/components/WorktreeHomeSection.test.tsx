// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { settingsApi } from '../api';
import { chooseFolder } from '../store';
import { WorktreeHomeSection } from './WorktreeHomeSection';

vi.mock('../api', () => ({
  settingsApi: { getWorktreeHome: vi.fn(), setWorktreeHome: vi.fn() },
}));
vi.mock('../store', () => ({ chooseFolder: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const DEFAULT = 'D:\\guild-data\\worktrees';

function field() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: /置き場のフォルダ/ });
}

it('shows the default, saves an absolute folder and clears back to the default', async () => {
  vi.mocked(settingsApi.getWorktreeHome).mockResolvedValue({ path: null, defaultPath: DEFAULT });
  vi.mocked(settingsApi.setWorktreeHome).mockResolvedValue(null);
  render(<WorktreeHomeSection />);
  await waitFor(() => expect(field().disabled).toBe(false));
  expect(field().placeholder).toBe(DEFAULT);
  expect(screen.getByText(DEFAULT)).toBeTruthy();
  expect(screen.getByText(/worktrees フォルダ）を外してかまいません/)).toBeTruthy();
  expect(screen.getByText(/worktrees フォルダは写しません/)).toBeTruthy();
  expect(screen.getByText(/git worktree repair が必要です/)).toBeTruthy();
  const save = screen.getByRole<HTMLButtonElement>('button', { name: '置き場を保存' });
  expect(save.disabled).toBe(true);

  fireEvent.change(field(), { target: { value: '  E:\\wt  ' } });
  fireEvent.click(save);
  await waitFor(() => expect(settingsApi.setWorktreeHome).toHaveBeenCalledWith('E:\\wt'));
  await waitFor(() => expect(screen.getByText('E:\\wt')).toBeTruthy());

  fireEvent.change(field(), { target: { value: '' } });
  fireEvent.click(save);
  await waitFor(() => expect(settingsApi.setWorktreeHome).toHaveBeenLastCalledWith(null));
  await waitFor(() => expect(screen.getByText(DEFAULT)).toBeTruthy());
});

it('rejects relative paths before saving and fills the field from the folder picker', async () => {
  vi.mocked(settingsApi.getWorktreeHome).mockResolvedValue({ path: 'E:\\wt', defaultPath: DEFAULT });
  vi.mocked(chooseFolder).mockResolvedValue('F:\\picked');
  render(<WorktreeHomeSection />);
  await waitFor(() => expect(field().value).toBe('E:\\wt'));
  fireEvent.change(field(), { target: { value: 'worktrees' } });
  expect(screen.getByText(/絶対パスで入力してください/)).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '置き場を保存' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'フォルダを選ぶ…' }));
  await waitFor(() => expect(field().value).toBe('F:\\picked'));
  expect(settingsApi.setWorktreeHome).not.toHaveBeenCalled();
});

it('shows the server message when saving fails', async () => {
  vi.mocked(settingsApi.getWorktreeHome).mockResolvedValue({ path: null, defaultPath: DEFAULT });
  vi.mocked(settingsApi.setWorktreeHome).mockRejectedValue({ code: 'storage', message: '書けません', field: null });
  render(<WorktreeHomeSection />);
  await waitFor(() => expect(field().disabled).toBe(false));
  fireEvent.change(field(), { target: { value: 'E:\\wt' } });
  fireEvent.click(screen.getByRole('button', { name: '置き場を保存' }));
  await waitFor(() => expect(screen.getByText('書けません')).toBeTruthy());
});
