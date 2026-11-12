import { AgentSections } from '@/features/agents';
import { ChannelList } from '@/features/channels';
import { ProfileCard } from '@/features/profile';
import { useAnyoneWorking } from '@/features/runtime';
import { openSettings } from '@/features/settings';
import { Crest } from '@/shared/ui';
import { t } from './i18n';
import styles from './Sidebar.module.css';

/** 左のサイドバー: 紋の行・チャンネル・先頭のタグごとのエージェント・自分のプロフィール */
export function Sidebar() {
  const working = useAnyoneWorking();
  return (
    <aside className={styles.sidebar} aria-label={t('sidebar')}>
      <div className={styles.brand}>
        <Crest lit={working} />
        {t('appName')}
      </div>
      <nav className={styles.scroll} aria-label={t('navigation')}>
        <ChannelList />
        <AgentSections />
      </nav>
      <ProfileCard onOpenSettings={() => openSettings()} />
    </aside>
  );
}
