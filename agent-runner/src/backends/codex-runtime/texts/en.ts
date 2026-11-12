import type { Messages } from '../../../i18n.ts';
import type { ja } from './ja.ts';

export const en: Messages<typeof ja> = {
  notFound: 'Codex needs to be set up. Continue from Settings → Backends → Codex in AI Guild.',
  needsLogin: 'To use Codex, sign in with your ChatGPT account.',
  needsLoginTerminal: 'Run `codex login` in a terminal or set the OPENAI_API_KEY environment variable.',
  loginLabel: 'Sign in with ChatGPT',
  loginWaiting: 'Sign in to ChatGPT in the browser.',
  loginFailed: 'Could not sign in to ChatGPT. Check the browser and try again.',
  runFailed: 'Codex failed to run ({detail})',
  longPath:
    'On Windows, Codex CLI cannot start when the path is longer than 260 characters. Move the project to a shorter path.',
  systemPromptTooLong: 'The system prompt for Codex can be up to {max} characters',
  folderNeedsSandbox:
    'The folder restriction requires OS isolation (with this backend, it works on Windows 11 where isolation is available)',
  ruleWrite:
    'Allowing writes makes it impossible to stop commands (programs) from running inside the workspace. Also allow runCommands',
  ruleWriteAnywhere:
    'Writing outside the workspace turns off the sandbox, so network access cannot be stopped either. Also allow writeFiles and webFetch',
  cannotStopReads: 'Reading files cannot be stopped (Codex reads them with the shell)',
  cannotStopSkills: 'Using skills, including skills installed for the whole user, cannot be stopped',
  experimental: '{name} (experimental, not verified against the real API)',
  webSearch: 'web search',
  webAndXSearch: 'web search and X search',
  providerModel: 'Via the Codex SDK. No {search}. API usage fees apply.',
  providerReady:
    'Experimental, not verified against the real API. "Ready" only means the API key and CLI were found, not that a connection succeeded.',
  providerNeedsKey:
    'Save an API key in Settings → Backends, or set the {envVar} environment variable and restart the app. {name} does not support web sign-in.',
  providerFailed: '{name} failed to run. Check the API key, quota, model name, and connection.',
  providerKeyRequired: 'The {envVar} environment variable is required.',
  providerNoWebSearch: '{name} does not support {search}. Turn off web search.',
  providerEffort: 'Choose a reasoning effort for {name} from {choices}.',
  providerModelOnly: 'Choose {model} for {name}.',
};
