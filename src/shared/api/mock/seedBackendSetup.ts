// モックのバックエンドが申告する、アプリからのセットアップ（agent-runner のアダプタの申告と同じ内容）。
import type { BackendSetup } from '@/shared/types/domain';

export const CLAUDE_SETUP: BackendSetup = {
  install: {
    cli: 'Claude Code',
    publisher: 'Anthropic',
    scriptUrl: 'https://claude.ai/install.sh',
    shell: '/bin/bash',
    binary: 'claude',
    env: {},
    docsUrl: 'https://code.claude.com/docs/ja/quickstart',
    loginCommand: 'claude auth login',
  },
  start: null,
  login: {
    label: 'Claude Code でログイン',
    waiting: '開いた窓とブラウザでログインを進めてください。終わると自動で状態が変わります。',
  },
  apiKey: null,
};

export const CODEX_SETUP: BackendSetup = {
  install: {
    cli: 'Codex CLI',
    publisher: 'OpenAI',
    scriptUrl: 'https://chatgpt.com/codex/install.sh',
    shell: '/bin/sh',
    binary: 'codex',
    env: { CODEX_INSTALL_DIR: '{bin}', CODEX_NON_INTERACTIVE: '1' },
    docsUrl: 'https://learn.chatgpt.com/docs/codex/cli#install-codex',
    loginCommand: 'codex login',
  },
  start: null,
  login: null,
  apiKey: null,
};

export const OLLAMA_SETUP: BackendSetup = {
  install: null,
  start: { macBundleId: 'com.electron.ollama' },
  login: null,
  apiKey: null,
};
