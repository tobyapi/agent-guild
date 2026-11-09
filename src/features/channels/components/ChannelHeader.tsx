import { useAllAgents } from '@/features/agents';
import { useChannelActivities, useChannelQueue } from '@/features/runtime';
import { Icon, IconButton, Lamp, reportError } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { useMemberPanelOpen } from '../hooks/useChannels';
import { workingSummary } from '../model/channels';
import { MEMBER_PANEL_ID } from '../model/ids';
import { openChannelEditor, stopChannel, toggleMemberPanel } from '../store';
import styles from './ChannelHeader.module.css';

/** チャンネルヘッダー: #名前・話題・作業中の表示と停止・編集・メンバーパネルの開閉 */
export function ChannelHeader({ channel }: { channel: Channel }) {
  const membersOpen = useMemberPanelOpen();
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        <span className={styles.hash} aria-hidden="true">
          #
        </span>
        {channel.name}
      </h1>
      {channel.topic && <span className={styles.separator} aria-hidden="true" />}
      <p className={styles.topic} title={channel.topic || undefined}>
        {channel.topic}
      </p>
      <WorkingStatus channelId={channel.id} />
      <div className={styles.actions}>
        <IconButton label="チャンネルを編集" onClick={() => openChannelEditor(channel.id)}>
          <Icon name="edit" />
        </IconButton>
        <IconButton label="メンバー" aria-pressed={membersOpen} aria-controls={MEMBER_PANEL_ID} onClick={toggleMemberPanel}>
          <Icon name="users" />
        </IconButton>
      </div>
    </header>
  );
}

/** 実行中・待機中のジョブがあるときだけ: 灯＋「ハル が作業中 · 待機 1」＋停止 */
function WorkingStatus({ channelId }: { channelId: string }) {
  const activities = useChannelActivities(channelId);
  const queue = useChannelQueue(channelId);
  const agents = useAllAgents();
  const pending = queue?.pending ?? 0;
  if ((queue?.running ?? 0) + pending === 0) return null;
  const names = activities.map((activity) => agents.find((agent) => agent.id === activity.agentId)?.name ?? '…');
  return (
    <div className={styles.working}>
      <Lamp waiting={activities.length === 0} />
      <span className={styles.workingText}>{workingSummary(names, pending)}</span>
      <button
        type="button"
        className={styles.stop}
        title="実行中の返答を止め、待ち行列を空にします"
        onClick={() => void stopChannel(channelId).catch(reportError)}
      >
        <span className={styles.stopMark} aria-hidden="true" />
        停止
      </button>
    </div>
  );
}
