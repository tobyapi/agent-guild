import { BackendStatus, refreshBackends, useBackends, useCheckingBackends } from '@/features/runtime';
import { Button, reportError, Tag } from '@/shared/ui';
import { ApiKeySettings } from './ApiKeySettings';
import styles from './SettingsDialog.module.css';

/** バックエンド: すべてのバックエンドの状態と［すべて再確認］（docs/ui-design.md §6.2） */
export function BackendsSection() {
  const backends = useBackends();
  const checking = useCheckingBackends();
  return (
    <>
      <div className={styles.sectionAction}>
        <Button size="sm" onClick={() => void refreshBackends().catch(reportError)} disabled={checking}>
          {checking ? '確認中…' : 'すべて再確認'}
        </Button>
      </div>
      {backends.length === 0 && <p className={styles.help}>エージェントの実行環境が起動すると表示されます。</p>}
      <ul className={styles.backends}>
        {backends.map((backend) => (
          <li key={backend.id} className={styles.backend}>
            <div className={styles.backendName}>
              <b>{backend.label}</b>
              <Tag>{backend.id}</Tag>
            </div>
            <BackendStatus backend={backend} />
            {(backend.id === 'grok' || backend.id === 'muse') && <ApiKeySettings backendId={backend.id} />}
          </li>
        ))}
      </ul>
    </>
  );
}
