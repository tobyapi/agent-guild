import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  noChannelTitle: 'Create your first channel',
  createChannel: 'Create channel',
  noChannelBody: 'Keeping a channel per topic helps agents keep the context straight.',
  sidebar: 'Sidebar',
  appName: 'AI Guild',
  navigation: 'Channels and agents',
  preparing: 'Getting AI Guild ready…',
  startFailed: 'Couldn’t start',
  retry: 'Retry',
  viewUpdate: 'View details',
};
