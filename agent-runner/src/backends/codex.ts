// Codex backend descriptor; execution is shared with Responses-compatible providers.
import { codexCatalog } from './codex-runtime/models.ts';
import { LEAK_RISKS, PERMISSION_RULES, UNRESTRICTED } from './codex-runtime/options.ts';
import { runCodex } from './codex-runtime.ts';
import { CAN_LOGIN, loginCodex } from './codex/login.ts';
import { probeCodex } from './codex/probe.ts';
import { NO_SETUP, type BackendAdapter, type BackendDescriptor } from './types.ts';

const INFO: BackendDescriptor = {
  id: 'codex',
  label: 'Codex',
  capabilities: {
    webSearch: true,
    webFetch: true,
    readFiles: true,
    readAnywhere: true,
    writeFiles: true,
    writeAnywhere: true,
    runCommands: true,
    skills: true,
  },
  // 推論の深さはモデルごとに選ぶ（models.ts の一覧。backendOptions の effort）
  options: [],
  permissionRules: [...PERMISSION_RULES],
  leakRisks: LEAK_RISKS.map((risk) => [...risk]),
  unrestricted: [...UNRESTRICTED],
  midRunPost: 'text',
  folderScope: 'sandbox',
  toolsOption: null,
  local: false,
  setup: {
    ...NO_SETUP,
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
    login: CAN_LOGIN ? { label: 'ChatGPT でログイン', waiting: 'ブラウザーで ChatGPT にログインしてください。' } : null,
  },
};

export const codexAdapter: BackendAdapter = {
  info: () => INFO,
  probe: probeCodex,
  catalog: () => Promise.resolve(codexCatalog()),
  run: runCodex,
  login: loginCodex,
};
