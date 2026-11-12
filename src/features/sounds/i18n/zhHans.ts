import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHans: Messages<typeof ja> = {
  sectionTitle: '通知',
  messageSound: '回复提示音',
  messageSoundHint: '收到智能体的消息时播放。',
  mentionSound: '提及我的提示音',
  mentionSoundHint: '收到提及你的消息时播放。',
  soundOff: '无',
  soundChime: '叮咚',
  soundBell: '铃声',
  soundPop: '啵',
  soundWood: '木鱼',
  preview: '试听',
  previewLabel: '试听{sound}',
  volume: '音量',
  onlyWhenUnfocused: '仅在窗口未聚焦时播放',
  onlyWhenUnfocusedHint: '只有在你使用其他应用时收到的消息才会发出提示音。',
};
