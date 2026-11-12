import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  loading: 'Loading…',
  currentLocation: 'Current location',
  newLocation: 'New location',
  openFolder: 'Open folder',
  change: 'Change…',
  sameFolder: 'This is already the current data location',
  sourceDefault: 'This is the default location.',
  sourceSettings: 'Set in Settings (default: {dir}).',
  sourceEnv: 'Set by the GUILD_DATA_DIR environment variable, so it can’t be changed here.',
  modeCopyLabel: 'Copy current data and use it',
  modeCopyDescription:
    'Copies channels, agents, and conversations to an empty folder and uses them. Your original data is kept.',
  modeOpenLabel: 'Open the data in that location',
  modeOpenDescription: 'Starts with the guild data in that folder. If the folder is empty, starts fresh.',
  changingCopy: 'Copying data…',
  changingOpen: 'Switching…',
  dialogTitle: 'Change data location',
  dialogDescription: 'AI Guild will restart and reopen with the data in the new location.',
  dialogLegend: 'What should happen to your current data?',
  cancel: 'Cancel',
  changeAndRestart: 'Change and restart',
  changedRestarting: 'Data location changed. Restarting the app…',
};
