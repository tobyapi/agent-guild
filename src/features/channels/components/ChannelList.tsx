import { useChannelQueue } from '@/features/runtime';
import { Lamp, SideRow, SideSection, VisuallyHidden } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { useActiveChannelId, useChannels } from '../hooks/useChannels';
import { openChannelCreator, selectChannel } from '../store';
import { t } from '../i18n';

/** サイドバーのチャンネルの区画 */
export function ChannelList() {
  const channels = useChannels();
  const activeId = useActiveChannelId();
  return (
    <SideSection
      title={t('channels')}
      onAdd={openChannelCreator}
      addLabel={t('createChannel')}
      emptyText={t('noChannels')}
      isEmpty={channels.length === 0}
    >
      {channels.map((channel) => (
        <ChannelRow key={channel.id} channel={channel} current={channel.id === activeId} />
      ))}
    </SideSection>
  );
}

/** 右端: 実行中のジョブがあれば灯、待機だけなら灯の輪郭（ActivityState.queues） */
function ChannelRow({ channel, current }: { channel: Channel; current: boolean }) {
  const queue = useChannelQueue(channel.id);
  const running = (queue?.running ?? 0) > 0;
  const waiting = !running && (queue?.pending ?? 0) > 0;
  return (
    <li>
      <SideRow
        leading="#"
        label={
          <>
            {channel.name}
            {running && <VisuallyHidden>{t('running')}</VisuallyHidden>}
          </>
        }
        trailing={running || waiting ? <Lamp waiting={waiting} /> : undefined}
        current={current}
        active={running}
        title={channel.topic || undefined}
        onClick={() => selectChannel(channel.id)}
      />
    </li>
  );
}
