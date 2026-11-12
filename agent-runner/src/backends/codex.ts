// Codex backend descriptor; execution is shared with Responses-compatible providers.
import { codexCatalog } from './codex-runtime/models.ts';
import { LEAK_RISKS, PERMISSION_RULES, UNRESTRICTED } from './codex-runtime/options.ts';
import { runCodex } from './codex-runtime.ts';
import { CAN_LOGIN, loginCodex } from './codex/login.ts';
import { probeCodex } from './codex/probe.ts';
import { assertSandboxedFolderScope } from './folder-scope.ts';
import type { BackendAdapter, BackendDescriptor } from './types.ts';

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
  canLogin: CAN_LOGIN,
  midRunPost: 'text',
};

export const codexAdapter: BackendAdapter = {
  info: () => INFO,
  probe: probeCodex,
  catalog: () => Promise.resolve(codexCatalog()),
  run: runCodex,
  folderScope: assertSandboxedFolderScope,
  login: loginCodex,
};
