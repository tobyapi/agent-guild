import { AgentSections } from '@/features/agents';
import { ChannelList } from '@/features/channels';
import { ProfileCard } from '@/features/profile';
import { useAnyoneWorking } from '@/features/runtime';
import { openSettings } from '@/features/settings';
import { Crest } from '@/shared/ui';
import styles from './Sidebar.module.css';

/** 左のサイドバー: 紋の行・チャンネル・先頭のタグごとのエージェント・自分のプロフィール */
export function Sidebar() {
  const working = useAnyoneWorking();
  return (
    <aside className={styles.sidebar} aria-label="サイドバー">
      <div className={styles.brand}>
        <Crest lit={working} />
        AIギルド
      </div>
      <nav className={styles.scroll} aria-label="チャンネルとエージェント">
        <ChannelList />
        <AgentSections />
      </nav>
      <ProfileCard onOpenSettings={() => openSettings()} />
    </aside>
  );
}
