import { useEffect } from 'react';
import { Button, FieldError, Icon, SwitchField } from '@/shared/ui';
import { setAutoCheck, useAutoCheckStore } from '../autoCheckStore';
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

  const autoCheck = useAutoCheckStore((s) => s.enabled);

  // 起動後の公開や通信の復旧に気づけるよう、開くたびに確かめ直す。
  // 自動の確認をオフにしていれば、押されるまで確かめない
  useEffect(() => {
    if (useAutoCheckStore.getState().enabled) void checkForUpdate();
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
      <SwitchField label={t('autoCheck')} hint={t('autoCheckHelp')} checked={autoCheck} onChange={setAutoCheck} />
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
