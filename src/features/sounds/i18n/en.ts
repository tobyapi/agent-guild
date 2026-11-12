import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  sectionTitle: 'Notifications',
  messageSound: 'Reply sound',
  messageSoundHint: 'Plays when a message from an agent arrives.',
  mentionSound: 'Mention sound',
  mentionSoundHint: 'Plays when a message that mentions you arrives.',
  soundOff: 'None',
  soundChime: 'Chime',
  soundBell: 'Bell',
  soundPop: 'Pop',
  soundWood: 'Wood',
  preview: 'Preview',
  previewLabel: 'Preview {sound}',
  volume: 'Volume',
  onlyWhenUnfocused: 'Only when the window isn’t focused',
  onlyWhenUnfocusedHint: 'Only messages that arrive while you’re using another app make a sound.',
};
