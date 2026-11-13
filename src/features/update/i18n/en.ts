import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  checkingSummary: 'Checking for a new version…',
  notChecked: 'Not checked yet',
  upToDate: 'Version {current} is up to date',
  available: 'Version {latest} is available (you have {current})',
  notice: 'Version {version} is available',
  checking: 'Checking…',
  check: 'Check for updates',
  installHelp: 'Working agents stop during the update. Conversations and data are kept.',
  installing: 'Updating…',
  install: 'Update and restart',
  autoCheck: 'Check for new versions automatically',
  autoCheckHelp:
    'Checks GitHub Releases on startup and every six hours. When off, the app checks only when you press Check for updates.',
};
