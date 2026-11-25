import { useActiveAgents } from '@/features/agents';
import { avatarFallback } from '@/shared/lib/avatar';
import { DEFAULT_MASCOT_AVATAR, type MascotSource } from '@/shared/theme/mascot';
import { useMascotImage } from './useBackgroundImage';

export function useMascotAvatar(source: MascotSource): string {
  const agents = useActiveAgents();
  const generated = useMascotImage(source.kind === 'generated' ? source.id : null);
  if (source.kind === 'preset') return source.avatar;
  if (source.kind === 'agent') {
    const agent = agents.find(({ id }) => id === source.id);
    if (agent) return agent.avatar || avatarFallback(agent.name);
  }
  return generated ?? DEFAULT_MASCOT_AVATAR;
}
