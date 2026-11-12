import { AgentSections } from '@/features/agents';
import { ChannelList } from '@/features/channels';
import { useGuildCrest, useGuildName } from '@/features/guild';
import { ProfileCard } from '@/features/profile';
import { useAnyoneWorking } from '@/features/runtime';
import { openSettings } from '@/features/settings';
import { Crest } from '@/shared/ui';
import { t } from './i18n';
import styles from './Sidebar.module.css';

/** 左のサイドバー: 紋の行・チャンネル・先頭のタグごとのエージェント・自分のプロフィール */
export function Sidebar() {
  const working = useAnyoneWorking();
  const crest = useGuildCrest();
  const name = useGuildName();
  return (
    <aside className={styles.sidebar} aria-label={t('sidebar')}>
      <div className={styles.brand}>
        <Crest lit={working} shape={crest.shape} color={crest.color} />
        <span className={styles.name} title={name}>
          {name}
        </span>
      </div>
      <nav className={styles.scroll} aria-label={t('navigation')}>
        <ChannelList />
        <AgentSections />
      </nav>
      <ProfileCard onOpenSettings={() => openSettings()} />
    </aside>
  );
}
