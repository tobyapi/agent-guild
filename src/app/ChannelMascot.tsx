import { useChannelActivities, useChannelQueue } from '@/features/runtime';
import { MascotScene, useAppearanceStore, useMascotAvatar } from '@/features/settings';
import type { Channel } from '@/shared/types/domain';
import { useDocumentTheme } from '@/shared/ui/theme/useDocumentTheme';

export function ChannelMascot({ channel }: { channel: Channel }) {
  const enabled = useAppearanceStore((state) => state.mascot.enabled);
  return enabled ? <ChannelMascotScene channel={channel} /> : null;
}

function ChannelMascotScene({ channel }: { channel: Channel }) {
  const { layout, source } = useAppearanceStore((state) => state.mascot);
  const scheme = useDocumentTheme();
  const avatar = useMascotAvatar(source);
  const activities = useChannelActivities(channel.id);
  const queue = useChannelQueue(channel.id);
  return (
    <MascotScene
      avatar={avatar}
      layout={layout}
      scheme={scheme}
      running={queue?.running ?? activities.length}
      pending={queue?.pending ?? 0}
    />
  );
}
