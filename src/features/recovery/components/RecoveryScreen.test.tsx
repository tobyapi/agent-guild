// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { applyLanguage } from '@/shared/i18n';
import type { BootStatus, Language } from '@/shared/types/domain';
import { recoveryApi } from '../api';
import { t } from '../i18n';
import { RecoveryScreen } from './RecoveryScreen';

const dataDir = 'D:/guild';
const backupPath = dataDir + '/backups/pre-1.0.0/example/guild.db';
const logPath = 'C:/Logs/agent-guild.log';
const boot: BootStatus = {
  state: 'recovery',
  reason: 'conversion_failed',
  conversion: { backupPath, logPath },
  dataDir,
  needsSetup: false,
  message: 'invalid message root',
  language: null,
};
const languages: Language[] = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];

afterEach(() => {
  cleanup();
  applyLanguage('ja');
  vi.restoreAllMocks();
});

it.each(languages)('offers retry and v0.1.28 with the actual recovery paths in %s', async (lang) => {
  applyLanguage(lang);
  vi.spyOn(recoveryApi, 'storageInfo').mockResolvedValue({ dataDir, defaultDataDir: dataDir, source: 'default' });
  const retry = vi.spyOn(recoveryApi, 'restartApp').mockResolvedValue(null);
  const release = vi.spyOn(recoveryApi, 'openLegacyRelease').mockResolvedValue(null);
  render(<RecoveryScreen boot={boot} />);
  await waitFor(() =>
    expect(screen.getByRole<HTMLButtonElement>('button', { name: t('useDefault') }).disabled).toBe(true),
  );
  expect(screen.getByRole('heading').textContent).toBe(t('conversionTitle'));
  expect(screen.getByText(t('conversionDescription')).textContent).toContain('v0.1.28');
  expect(screen.getByText(backupPath)).toBeTruthy();
  expect(screen.getByText(logPath)).toBeTruthy();
  const primary = screen.getByRole<HTMLButtonElement>('button', { name: t('retry') });
  expect(primary.parentElement?.firstElementChild).toBe(primary);
  fireEvent.click(primary);
  await waitFor(() => expect(primary.disabled).toBe(false));
  expect(retry).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: t('legacyDownload') }));
  expect(release).toHaveBeenCalledOnce();
});

it('shows the stderr destination when preflight fails before a backup exists', async () => {
  vi.spyOn(recoveryApi, 'storageInfo').mockResolvedValue({ dataDir, defaultDataDir: dataDir, source: 'default' });
  render(<RecoveryScreen boot={{ ...boot, conversion: { backupPath: null, logPath: null } }} />);
  await waitFor(() =>
    expect(screen.getByRole<HTMLButtonElement>('button', { name: t('useDefault') }).disabled).toBe(true),
  );
  expect(screen.queryByText(t('backupLocation'))).toBeNull();
  expect(screen.getByText(t('standardError'))).toBeTruthy();
});
