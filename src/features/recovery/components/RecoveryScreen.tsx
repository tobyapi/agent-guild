import { Button, Crest, FormAlert, Icon } from '@/shared/ui';
import type { BootStatus } from '@/shared/types/domain';
import { useRecovery } from '../hooks/useRecovery';
import { t } from '../i18n';
import { orderedActions, reasonCopy, recommendedAction } from '../model/reasons';
import type { RecoveryAction } from '../model/reasons';
import styles from './RecoveryScreen.module.css';

const ACTION_LABELS = { retry: 'retry', choose: 'choose', useDefault: 'useDefault' } as const;

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
      title={action === 'useDefault' && recovery.atDefault ? t('atDefault') : undefined}
    >
      {t(ACTION_LABELS[action])}
    </Button>
  );
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <Crest size="lg" />
        <p className={styles.kicker}>{t('kicker')}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>{copy.description}</p>
        <div className={styles.location}>
          <span className={styles.label}>{t('location')}</span>
          <code className={styles.path}>{boot.dataDir}</code>
          {boot.reason !== 'missing' && (
            <Button size="sm" variant="ghost" onClick={recovery.reveal}>
              <Icon name="folder" />
              {t('openFolder')}
            </Button>
          )}
        </div>
        <div className={styles.actions}>
          {primary && actionButton(primary, 'primary')}
          {others.map((action) => actionButton(action, 'secondary'))}
        </div>
        {recovery.error && <FormAlert>{recovery.error}</FormAlert>}
        <p className={styles.note}>{t('note')}</p>
        {boot.message && (
          <details className={styles.details}>
            <summary className={styles.summary}>{t('details')}</summary>
            <pre className={styles.message}>{boot.message}</pre>
          </details>
        )}
      </div>
    </main>
  );
}
