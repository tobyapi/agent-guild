import type { Messages } from '../../../i18n.ts';
import type { ja } from './ja.ts';

export const en: Messages<typeof ja> = {
  notFound: 'Claude needs to be set up. Continue from Settings → Backends → Claude in AI Guild.',
  loginAtRun: 'The sign-in status is checked when it runs',
  needsLogin: 'To use Claude, sign in to your Claude account in the browser.',
  needsLoginTerminal:
    'You are not signed in to Claude. Run `claude auth login` in a terminal or set the ANTHROPIC_API_KEY environment variable.',
  loginFailed: 'Could not sign in to Claude. Check the browser and try again.',
  loginWindowFailed: 'Could not open the sign-in window ({reason})',
  loginIncomplete: 'Signing in to Claude did not finish. Complete the sign-in in the opened window and the browser',
  loginLabel: 'Sign in with Claude Code',
  loginWaiting: 'Continue signing in in the opened window and the browser. The status updates automatically when done.',
  maxTurnsLabel: 'Max turns',
  maxTurnsDescription: 'The maximum number of tool round trips in a single reply',
  operationCheckLabel: 'Operation check',
  operationCheckDescription:
    'Before running commands, opening web pages, or writing outside the workspace, a small model (Haiku) checks that the action matches the request and stops it if suspicious (without asking a human)',
  folderUnsupported:
    "Claude's file operations cannot prevent links from being swapped after they are checked, so Claude cannot run in a designated folder",
  runFailed: 'Could not run Claude ({detail})',
  hintAuth:
    'Claude authentication failed. Run `claude` in a terminal to sign in, or set the ANTHROPIC_API_KEY environment variable.',
  hintRateLimit:
    'Could not run because of Claude usage limits, rate limits, or high load. Wait a moment and send your message again.',
  hintModelNotFound: 'The specified model was not found. Check the model name in the agent settings.',
  hintDetail: '{hint} ({detail})',
  failed: 'Claude returned an error ({detail})',
  interrupted: 'The Claude run ended before finishing ({detail})',
  imageType: 'Unsupported image format: {type}',
  imageRead: 'Could not read the attached image ({path})',
  ruleWrite: 'To allow writing outside the workspace, also allow writing files',
  ruleBash:
    'Allowing commands makes it impossible to stop file access (including outside the workspace) and network access',
};
