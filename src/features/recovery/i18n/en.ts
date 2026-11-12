import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  retry: 'Retry',
  choose: 'Choose another folder',
  useDefault: 'Use the default location',
  atDefault: 'This is already the default location',
  kicker: 'Couldn’t open the data folder',
  location: 'Location',
  openFolder: 'Open folder',
  note: 'Switching to the default location doesn’t delete the data in the current folder.',
  details: 'Details',
  restarting: 'Restarting…',
  fallbackTitle: 'Couldn’t open the data folder',
  missingTitle: 'Data folder not found',
  missingDescription:
    'The configured location can’t be reached. If it’s on an external drive or a network location, connect it and retry.',
  lockedTitle: 'AI Guild is already running',
  lockedDescription: 'Another AI Guild is running with the same data folder. Close it, then retry.',
  newerTitle: 'Data from a newer version',
  newerDescription:
    'This folder was saved by a newer AI Guild. To protect your data, this version won’t open it. Update the app or choose another folder.',
  foreignTitle: 'Not an AI Guild data folder',
  foreignDescription:
    'This folder contains files that aren’t from AI Guild. To protect them, this folder won’t be used.',
  corruptTitle: 'Couldn’t load the data',
  corruptDescription: 'The database may be damaged. The original files haven’t been changed.',
  notWritableTitle: 'Can’t write to this folder',
  notWritableDescription:
    'You don’t have permission to write here. Check the folder’s permissions or choose another folder.',
};
