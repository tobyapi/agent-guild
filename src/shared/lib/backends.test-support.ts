// テストで使うバックエンドの申告: 追加の申告が何もない形（指定フォルダでは実行できない・道具は役割どおり・セットアップなし）。
// 確かめたい項目だけを上書きして使う。
import type { BackendInfo, BackendSetup } from '@/shared/types/domain';

export const NO_SETUP: BackendSetup = { install: null, start: null, login: null, apiKey: null };

export function backendInfo(overrides: Partial<BackendInfo> = {}): BackendInfo {
  return {
    id: 'fake',
    label: 'Fake',
    models: [],
    defaultModel: '',
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
    status: 'ready',
    statusMessage: '',
    options: [],
    permissionRules: [],
    leakRisks: [],
    unrestricted: [],
    midRunPost: null,
    folderScope: null,
    toolsOption: null,
    local: false,
    frameGeneration: false,
    setup: NO_SETUP,
    ...overrides,
  };
}
