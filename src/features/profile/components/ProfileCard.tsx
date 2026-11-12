import { Avatar, Icon } from '@/shared/ui';
import { useProfile } from '../hooks/useProfile';
import { t } from '../i18n';
import styles from './ProfileCard.module.css';

export interface ProfileCardProps {
  onOpenSettings: () => void;
}

/** サイドバーの最下部の自分のプロフィール。押すと設定を開く */
export function ProfileCard({ onOpenSettings }: ProfileCardProps) {
  const me = useProfile();
  return (
    <button
      type="button"
      className={styles.card}
      onClick={onOpenSettings}
      aria-label={t('openSettings', { name: me.name })}
    >
      <Avatar avatar={me.avatar} name={me.name} color={me.color} size="row" human />
      <span className={styles.text}>
        <span className={styles.name}>{me.name}</span>
        <span className={styles.sub}>{t('you')}</span>
      </span>
      <Icon name="settings" className={styles.icon} />
    </button>
  );
}
