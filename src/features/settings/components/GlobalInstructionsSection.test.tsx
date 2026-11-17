// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { settingsApi } from '../api';
import { GlobalInstructionsSection } from './GlobalInstructionsSection';

vi.mock('../api', () => ({
  settingsApi: {
    getGlobalInstructions: vi.fn(),
    setGlobalInstructions: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('loads Markdown, saves edits and allows clearing the instructions', async () => {
  vi.mocked(settingsApi.getGlobalInstructions).mockResolvedValue('# 保存済み\n約束');
  vi.mocked(settingsApi.setGlobalInstructions).mockResolvedValue(null);
  render(<GlobalInstructionsSection />);
  const input = screen.getByRole('textbox');
  await waitFor(() => expect((input as HTMLTextAreaElement).value).toBe('# 保存済み\n約束'));
  const save = screen.getByRole('button', { name: '共通の指示を保存' });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(input, { target: { value: '# 新しい指示\n😀' } });
  fireEvent.click(save);
  await waitFor(() => expect(settingsApi.setGlobalInstructions).toHaveBeenCalledWith('# 新しい指示\n😀'));
  await waitFor(() => expect((save as HTMLButtonElement).disabled).toBe(true));
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(save);
  await waitFor(() => expect(settingsApi.setGlobalInstructions).toHaveBeenLastCalledWith(''));
});

it('shows oversize input and disables saving at the same UTF-16 limit as Rust', async () => {
  vi.mocked(settingsApi.getGlobalInstructions).mockResolvedValue('');
  render(<GlobalInstructionsSection />);
  const input = screen.getByRole('textbox');
  await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(input, { target: { value: '😀'.repeat(2_001) } });
  expect(screen.getByText(/4,000文字以内/)).toBeTruthy();
  expect(screen.getByText('4002 / 4000')).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  fireEvent.change(input, { target: { value: 'a'.repeat(4_000) } });
  expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(false);
  expect(settingsApi.setGlobalInstructions).not.toHaveBeenCalled();
});

it('keeps edits when saving fails and permits retry', async () => {
  vi.mocked(settingsApi.getGlobalInstructions).mockResolvedValue('old');
  vi.mocked(settingsApi.setGlobalInstructions).mockRejectedValueOnce(new Error('storage'));
  render(<GlobalInstructionsSection />);
  const input = await screen.findByDisplayValue('old');
  fireEvent.change(input, { target: { value: 'new' } });
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((input as HTMLTextAreaElement).value).toBe('new');
  expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(false);
});

it('does not allow overwriting settings when loading fails', async () => {
  vi.mocked(settingsApi.getGlobalInstructions).mockRejectedValue(new Error('read'));
  render(<GlobalInstructionsSection />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
});

it('allows correcting an oversized setting edited outside the app', async () => {
  vi.mocked(settingsApi.getGlobalInstructions).mockResolvedValue('a'.repeat(4_001));
  vi.mocked(settingsApi.setGlobalInstructions).mockResolvedValue(null);
  render(<GlobalInstructionsSection />);
  const input = screen.getByRole('textbox');
  await waitFor(() => expect((input as HTMLTextAreaElement).value.length).toBe(4_001));
  expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  fireEvent.change(input, { target: { value: 'corrected' } });
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(settingsApi.setGlobalInstructions).toHaveBeenCalledWith('corrected'));
});
