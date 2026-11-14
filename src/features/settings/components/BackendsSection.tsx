import { useEffect, useState } from 'react';
import { BackendStatus, refreshBackends, useBackends, useCheckingBackends } from '@/features/runtime';
import { Button, reportError, Tag } from '@/shared/ui';
import { tBackends as t } from '../i18n/backends';
import { ApiKeySettings } from './ApiKeySettings';
import { BackendInstallGuide } from './BackendInstallGuide';
import { settingsApi } from '../api';
import styles from './SettingsDialog.module.css';

/**
 * バックエンド: すべてのバックエンドの状態と［すべて再確認］（docs/ui-design.md §6.2）。インストールの案内と API キーの欄は、
 * バックエンドが申告している（setup）ときだけ出す
 */
export function BackendsSection() {
  const backends = useBackends();
  const checking = useCheckingBackends();
  const [authModes, setAuthModes] = useState<Record<string, 'desktop' | 'api'>>({});
  useEffect(() => {
    let active = true;
    void settingsApi
      .backendAuthModes()
      .then((modes) => {
        if (active) setAuthModes(modes);
      })
      .catch(reportError);
    return () => {
      active = false;
    };
  }, []);

  async function changeAuthMode(backendId: string, mode: 'desktop' | 'api') {
    await settingsApi.setBackendAuthMode(backendId, mode);
    setAuthModes((current) => ({ ...current, [backendId]: mode }));
    await refreshBackends();
  }
  return (
    <>
      <div className={styles.sectionAction}>
        <Button size="sm" onClick={() => void refreshBackends().catch(reportError)} disabled={checking}>
          {checking ? t('checking') : t('recheckAll')}
        </Button>
      </div>
      {backends.length === 0 && <p className={styles.help}>{t('waitingForRuntime')}</p>}
      <ul className={styles.backends}>
        {backends.map((backend) => (
          <li key={backend.id} className={styles.backend}>
            <div className={styles.backendName}>
              <b>{backend.label}</b>
              <Tag>{backend.id}</Tag>
            </div>
            <BackendStatus backend={backend} />
            {backend.setup.install && backend.status === 'unavailable' && (
              <BackendInstallGuide backend={backend} guide={backend.setup.install} />
            )}
            {['claude', 'codex'].includes(backend.id) && (
              <div>
                <div
                  className={styles.authMode}
                  role="group"
                  aria-label={t('authModeLabel', { backend: backend.label })}
                >
                  {(['desktop', 'api'] as const).map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      aria-pressed={(authModes[backend.id] ?? 'desktop') === mode}
                      onClick={() => void changeAuthMode(backend.id, mode).catch(reportError)}
                    >
                      {t(mode === 'desktop' ? 'authDesktop' : 'authApi')}
                    </Button>
                  ))}
                </div>
                {(authModes[backend.id] ?? 'desktop') === 'api' && backend.setup.apiKey && (
                  <ApiKeySettings backend={backend} envVar={backend.setup.apiKey.envVar} />
                )}
              </div>
            )}
            {!['claude', 'codex'].includes(backend.id) && backend.setup.apiKey && (
              <ApiKeySettings backend={backend} envVar={backend.setup.apiKey.envVar} />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
