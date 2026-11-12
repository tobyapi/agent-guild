import { BackendStatus, refreshBackends, useBackends, useCheckingBackends } from '@/features/runtime';
import { Button, reportError, Tag } from '@/shared/ui';
import { tBackends as t } from '../i18n/backends';
import { ApiKeySettings } from './ApiKeySettings';
import { BackendInstallGuide } from './BackendInstallGuide';
import styles from './SettingsDialog.module.css';

/**
 * バックエンド: すべてのバックエンドの状態と［すべて再確認］（docs/ui-design.md §6.2）。インストールの案内と API キーの欄は、
 * バックエンドが申告している（setup）ときだけ出す
 */
export function BackendsSection() {
  const backends = useBackends();
  const checking = useCheckingBackends();
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
            {backend.setup.apiKey && <ApiKeySettings backend={backend} envVar={backend.setup.apiKey.envVar} />}
          </li>
        ))}
      </ul>
    </>
  );
}
