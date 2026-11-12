import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  statusReady: 'Ready',
  statusNeedsAuth: 'Sign-in required',
  statusStopped: 'Stopped',
  statusUnavailable: 'Unavailable',
  startingModels: 'Waiting for {backend} to start and load its model list.',
  starting: 'Starting…',
  start: 'Start {backend}',
  loggingIn: 'Signing in…',
  checking: 'Checking…',
  recheck: 'Recheck',
  unknownBackend: 'This backend isn’t available in this environment',
  runtimeStarting: 'Starting the agent runtime…',
  runtimeUnavailable: 'Agents can’t run',
  restart: 'Restart',
  runtimeReady: 'The agent runtime is ready',
  recheckDone: 'Finished rechecking backends. Check the status of each backend.',
};
