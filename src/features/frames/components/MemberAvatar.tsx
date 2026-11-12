import { Avatar } from '@/shared/ui';
import type { AvatarProps } from '@/shared/ui';
import { useResolvedFrame } from '../hooks/useFrames';

export interface MemberAvatarProps extends Omit<AvatarProps, 'frame'> {
  /** 保存した枠の ID（'' は枠なし） */
  frame: string;
}

/** 選んだ枠を重ねたメンバー（人間・エージェント）のアバター */
export function MemberAvatar({ frame, ...props }: MemberAvatarProps) {
  return <Avatar {...props} frame={useResolvedFrame(frame)} />;
}
