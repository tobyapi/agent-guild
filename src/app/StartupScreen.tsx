import { Button, Crest } from '@/shared/ui';
import { t } from './i18n';
import styles from './StartupScreen.module.css';

export interface StartupScreenProps {
  /** 起動に失敗したときの理由（なければ起動中） */
  error?: string;
  onRetry?: () => void;
}

/** 起動中・起動失敗の画面 */
export function StartupScreen({ error, onRetry }: StartupScreenProps) {
  return (
    <main className={styles.screen} aria-busy={error === undefined}>
      <div className={styles.content} role={error ? 'alert' : 'status'}>
        <Crest size="lg" lit={error === undefined} />
        {error === undefined ? (
          <p className={styles.text}>{t('preparing')}</p>
        ) : (
          <>
            <h1 className={styles.title}>{t('startFailed')}</h1>
            <p className={styles.text}>{error}</p>
            {onRetry && (
              <Button variant="primary" onClick={onRetry}>
                {t('retry')}
              </Button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
