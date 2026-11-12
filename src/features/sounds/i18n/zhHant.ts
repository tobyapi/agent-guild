import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const zhHant: Messages<typeof ja> = {
  sectionTitle: '通知',
  messageSound: '回覆提示音',
  messageSoundHint: '收到代理人的訊息時播放。',
  mentionSound: '提及我的提示音',
  mentionSoundHint: '收到提及你的訊息時播放。',
  soundOff: '無',
  soundChime: '叮咚',
  soundBell: '鈴聲',
  soundPop: '啵',
  soundWood: '木魚',
  preview: '試聽',
  previewLabel: '試聽{sound}',
  volume: '音量',
  onlyWhenUnfocused: '僅在視窗未聚焦時播放',
  onlyWhenUnfocusedHint: '只有在你使用其他應用程式時收到的訊息才會發出提示音。',
};
