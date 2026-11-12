import { useEffect } from 'react';
import { Button, FieldError, Icon } from '@/shared/ui';
import { t } from '../i18n';
import { updateSummary } from '../model/update';
import { checkForUpdate, installUpdate, useUpdateStore } from '../store';
import styles from './UpdateSection.module.css';

/**
 * 設定の「アプリの更新」（docs/ui-design.md §6.7）: いまの版、［更新を確認］、
 * 新しい版があればその説明と［更新して再起動］
 */
export function UpdateSection() {
  const state = useUpdateStore();
  const { phase, status, error } = state;
  const latest = status?.latest ?? null;

  // まだ一度も確かめていなければ、開いたときに確かめる（起動時の確認が済んでいれば、その結果を出す）
  useEffect(() => {
    const { status: known, error: failed } = useUpdateStore.getState();
    if (known === null && failed === null) void checkForUpdate();
  }, []);

  return (
    <>
      <div className={styles.row}>
        <p className={styles.summary} aria-live="polite">
          {updateSummary(state)}
        </p>
        <Button size="sm" onClick={() => void checkForUpdate()} disabled={phase !== 'idle'}>
          <Icon name="refresh" />
          {phase === 'checking' ? t('checking') : t('check')}
        </Button>
      </div>
      {error !== null && <FieldError message={error} />}
      {latest !== null && (
        <div className={styles.available}>
          {latest.notes !== '' && <p className={styles.notes}>{latest.notes}</p>}
          <p className={styles.help}>{t('installHelp')}</p>
          <div>
            <Button variant="primary" onClick={() => void installUpdate()} disabled={phase !== 'idle'}>
              {phase === 'installing' ? t('installing') : t('install')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
