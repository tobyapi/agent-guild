import { Icon, notifyError } from '@/shared/ui';
import { t } from '../i18n';
import { installUpdate, useUpdateStore } from '../store';
import styles from './UpdateButton.module.css';

/** 設定を開かずに更新するので、失敗はその場で知らせる。 */
async function installFromSidebar(): Promise<void> {
  if (useUpdateStore.getState().phase !== 'idle') return;
  await installUpdate();
  const { error } = useUpdateStore.getState();
  if (error !== null) notifyError(error);
}

/** 新しい版があるときだけ、プロフィールの横に出す更新ボタン。 */
export function UpdateButton() {
  const latest = useUpdateStore((state) => state.status?.latest ?? null);
  const phase = useUpdateStore((state) => state.phase);
  if (latest === null) return null;

  const installing = phase === 'installing';
  const label = installing ? t('installing') : phase === 'checking' ? t('checking') : t('install');
  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => void installFromSidebar()}
      disabled={phase !== 'idle'}
      aria-label={label}
      aria-busy={installing}
      title={`${t('notice', { version: latest.version })} — ${label}`}
    >
      <Icon name={installing ? 'refresh' : 'arrowDown'} className={installing ? styles.spinner : styles.arrow} />
      {!installing && <span className={styles.tray} aria-hidden="true" />}
    </button>
  );
}
