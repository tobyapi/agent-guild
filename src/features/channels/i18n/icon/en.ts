import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  label: 'Icon',
  hint: 'Shown instead of # in the channel list and header. Pick an emoji or type one.',
  inputLabel: 'Icon emoji',
  inputPlaceholder: '#',
  suggestions: 'Suggested icons',
  none: 'None (#)',
  choose: 'Use {icon}',
  invalid: 'Use a single emoji for the icon',
};
