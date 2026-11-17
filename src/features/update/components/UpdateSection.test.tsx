// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { updateApi } from '../api';
import { useAutoCheckStore } from '../autoCheckStore';
import { INITIAL_UPDATE_STATE } from '../model/update';
import { useUpdateStore } from '../store';
import { UpdateButton } from './UpdateButton';
import { UpdateSection } from './UpdateSection';

vi.mock('../api', () => ({ updateApi: { check: vi.fn(), install: vi.fn() } }));
const available = { currentVersion: '0.1.15', latest: { version: '0.1.16', notes: '' } };
beforeEach(() => {
  vi.resetAllMocks();
  useUpdateStore.setState(INITIAL_UPDATE_STATE);
  useAutoCheckStore.setState({ enabled: true });
});
afterEach(cleanup);

it('does not check automatically when disabled but manual checking still shows the sidebar button', async () => {
  useAutoCheckStore.setState({ enabled: false });
  vi.mocked(updateApi.check).mockResolvedValue(available);
  render(
    <>
      <UpdateSection />
      <UpdateButton />
    </>,
  );
  expect(updateApi.check).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '更新を確認' }));
    await Promise.resolve();
  });
  expect(screen.queryAllByRole('button', { name: '更新して再起動' })).toHaveLength(2);
});

it('recovers on reopening settings after a previous failed check', async () => {
  useUpdateStore.setState({ error: 'offline' });
  vi.mocked(updateApi.check).mockResolvedValue(available);
  render(
    <>
      <UpdateSection />
      <UpdateButton />
    </>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByText('offline')).toBeNull();
  expect(screen.queryAllByRole('button', { name: '更新して再起動' })).toHaveLength(2);
});
