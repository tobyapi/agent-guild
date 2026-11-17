// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DesktopNotifications } from './DesktopNotifications';
import { getDesktopNotifications, setDesktopNotifications } from '../api';
vi.mock('../api', () => ({ getDesktopNotifications: vi.fn(), setDesktopNotifications: vi.fn() }));
vi.mock('@/shared/ui', async (original) => ({ ...(await original<object>()), reportError: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('loads the saved value and only changes after a successful save', async () => {
  vi.mocked(getDesktopNotifications).mockResolvedValue(true);
  vi.mocked(setDesktopNotifications).mockResolvedValue(null);
  render(<DesktopNotifications />);
  const toggle = screen.getByRole('switch');
  expect(toggle).toHaveProperty('disabled', true);
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
  expect(setDesktopNotifications).toHaveBeenCalledWith(false);
  vi.mocked(setDesktopNotifications).mockRejectedValue(new Error('save failed'));
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveProperty('disabled', false));
  expect(toggle.getAttribute('aria-checked')).toBe('false');
});

it('does not offer a false saved value when loading fails', async () => {
  vi.mocked(getDesktopNotifications).mockRejectedValue(new Error('unavailable'));
  render(<DesktopNotifications />);
  await waitFor(() => expect(screen.getByRole('switch')).toHaveProperty('disabled', true));
  expect(setDesktopNotifications).not.toHaveBeenCalled();
});
