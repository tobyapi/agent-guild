import { Button, Crest, FormAlert, Icon } from '@/shared/ui';
import type { BootStatus } from '@/shared/types/domain';
import { useRecovery } from '../hooks/useRecovery';
import { orderedActions, reasonCopy, recommendedAction } from '../model/reasons';
import type { RecoveryAction } from '../model/reasons';
import styles from './RecoveryScreen.module.css';

const ACTION_LABELS: Readonly<Record<RecoveryAction, string>> = {
  retry: '再試行',
  choose: '別のフォルダを選ぶ',
  useDefault: '既定の場所に戻す',
};

/** 復旧画面（データフォルダを開けなかったとき、アプリ全体の代わりに出す。docs/ui-design.md §6.5） */
export function RecoveryScreen({ boot }: { boot: BootStatus }) {
  const recovery = useRecovery(boot);
  const copy = reasonCopy(boot.reason);
  const [primary, ...others] = orderedActions(recommendedAction(boot.reason, recovery.atDefault));
  const actionButton = (action: RecoveryAction, variant: 'primary' | 'secondary') => (
    <Button
      key={action}
      variant={variant}
      className={variant === 'primary' ? styles.primaryAction : undefined}
      onClick={() => recovery.run(action)}
      disabled={recovery.busy || (action === 'useDefault' && recovery.atDefault)}
      title={action === 'useDefault' && recovery.atDefault ? 'いまの場所が既定です' : undefined}
    >
      {ACTION_LABELS[action]}
    </Button>
  );
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <Crest size="lg" />
        <p className={styles.kicker}>データフォルダを開けませんでした</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>{copy.description}</p>
        <div className={styles.location}>
          <span className={styles.label}>場所</span>
          <code className={styles.path}>{boot.dataDir}</code>
          {boot.reason !== 'missing' && (
            <Button size="sm" variant="ghost" onClick={recovery.reveal}>
              <Icon name="folder" />
              フォルダを開く
            </Button>
          )}
        </div>
        <div className={styles.actions}>
          {primary && actionButton(primary, 'primary')}
          {others.map((action) => actionButton(action, 'secondary'))}
        </div>
        {recovery.error && <FormAlert>{recovery.error}</FormAlert>}
        <p className={styles.note}>既定の場所に戻しても、いまのフォルダのデータは消えません。</p>
        {boot.message && (
          <details className={styles.details}>
            <summary className={styles.summary}>詳しい情報</summary>
            <pre className={styles.message}>{boot.message}</pre>
          </details>
        )}
      </div>
    </main>
  );
}
