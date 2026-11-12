import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  checking: 'Checking…',
  recheckAll: 'Recheck all',
  waitingForRuntime: 'Backends appear here once the agent runtime starts.',
  keySaved: 'Using the saved key',
  keyEnvironment: 'Using the key from an environment variable',
  keyUnset: 'No key is set',
  keyChecking: 'Checking the key status',
  keyStatusLine: '{status}. A saved key takes priority; otherwise the {envVar} environment variable is used.',
  keyWindowsOnly: 'Secure key storage is currently available only on Windows.',
  keyLabel: '{backend} API key',
  keyHint: 'Stored in Windows Credential Manager. Saved keys are never shown.',
  keyStoreUnavailable: 'Couldn’t check the credential store. Check the agent runtime and reopen Settings.',
  keySavedMessage: 'Saved. It will be used from the next run.',
  keyDeletedMessage: 'Deleted the saved key. If an environment variable has a key, that will be used.',
  keyChangeFailed:
    'Couldn’t make the change. Check the credential store and the agent runtime, and re-enter the key if needed.',
  keyUpdate: 'Update',
  keySave: 'Save',
  keyDelete: 'Delete',
  copied: 'Copied the install command.',
  copyFailed: 'Couldn’t copy automatically. Select the command and copy it.',
  settingUp: 'Setting up…',
  retry: 'Try again',
  setUp: 'Set up {backend}',
  installing: 'Downloading and installing {cli}. This may take a few minutes.',
  installDone: '{backend} has been installed.',
  manualSummary: 'How to install {cli}',
  manualIntro:
    'On macOS and Linux, you can install {cli} with the official installer from {publisher}, no Node.js or Homebrew required.',
  commandLabel: 'Command to run in a terminal (macOS, Linux)',
  copyCommand: 'Copy command',
  officialSteps: 'Official instructions from {publisher} (including Windows)',
  afterInstall:
    'When the installation finishes, press “Recheck” on this screen. To sign in from a terminal, run {command} in a new terminal.',
};
