import { AgentEditorDialog } from '@/features/agents';
import {
  ChannelDialog,
  ChannelHeader,
  MemberPanel,
  openChannelCreator,
  useActiveChannel,
  useChannels,
  useMemberPanelOpen,
} from '@/features/channels';
import { ChatView } from '@/features/chat';
import { RuntimeBanner } from '@/features/runtime';
import { openSettings, SettingsDialog } from '@/features/settings';
import { Button, EmptyState, Icon } from '@/shared/ui';
import { Sidebar } from './Sidebar';
import styles from './AppShell.module.css';

/** 骨組み: ［ランナーの帯］の下に サイドバー | チャンネル | メンバー の3列（docs/ui-design.md §5.1） */
export function AppShell() {
  const channel = useActiveChannel();
  const membersOpen = useMemberPanelOpen();
  return (
    <div className={styles.shell}>
      <RuntimeBanner />
      <div className={styles.columns} data-members={channel && membersOpen ? '' : undefined}>
        <Sidebar />
        <main className={styles.main}>
          {channel ? (
            <>
              <ChannelHeader channel={channel} />
              <ChatView channel={channel} />
            </>
          ) : (
            <NoChannel />
          )}
        </main>
        {channel && membersOpen && <MemberPanel channel={channel} />}
      </div>
      <Dialogs />
    </div>
  );
}

function NoChannel() {
  return (
    <div className={styles.empty}>
      <EmptyState
        title="最初のチャンネルを作りましょう"
        action={
          <Button variant="primary" onClick={openChannelCreator}>
            <Icon name="plus" />
            チャンネルを作成
          </Button>
        }
      >
        話題ごとにチャンネルを分けると、エージェントが文脈を取り違えにくくなります。
      </EmptyState>
    </div>
  );
}

/** エージェント編集のスキルから、ライブラリが未設定のときに設定の「スキルのフォルダ」へ案内する */
const openSkillLibrarySettings = () => openSettings('skillLibrary');

/** ダイアログ類（エージェント編集の自発活動の投稿先には、チャンネルの一覧を渡す） */
function Dialogs() {
  const channels = useChannels();
  return (
    <>
      <AgentEditorDialog channels={channels} onOpenSkillLibrarySettings={openSkillLibrarySettings} />
      <ChannelDialog />
      <SettingsDialog />
    </>
  );
}
