// モックのローカルのバックエンド（Ollama）の申告。道具の利用を切り替える設定と、アプリからの起動を持つ。
import type { BackendInfo } from '@/shared/types/domain';
import { OLLAMA_SETUP } from './seedBackendSetup';

export const MOCK_OLLAMA: BackendInfo = {
  id: 'ollama',
  label: 'Ollama（この PC）',
  models: [
    {
      id: 'deepseek-r1:8b',
      label: 'deepseek-r1:8b',
      description: '8.2B · 文章に対応 · JSON 操作（試作）',
      efforts: [],
      defaultEffort: null,
      tools: true,
    },
    {
      id: 'gemma4:26b',
      label: 'gemma4:26b',
      description: '画像と文章に対応 · JSON 操作（試作）',
      efforts: [],
      defaultEffort: null,
      tools: true,
    },
  ],
  defaultModel: 'deepseek-r1:8b',
  capabilities: {
    webSearch: false,
    webFetch: false,
    readFiles: true,
    readAnywhere: false,
    writeFiles: true,
    writeAnywhere: true,
    runCommands: true,
    skills: true,
  },
  status: 'ready',
  statusMessage: 'この PC のモデルを使います。',
  options: [
    {
      key: 'toolProtocol',
      label: '道具の要求形式',
      description:
        'auto は対応モデルのネイティブ呼び出しを使います。操作を呼ばない DeepSeek などでは json を選んでください。',
      type: 'select',
      choices: ['auto', 'json'],
      default: 'auto',
    },
    {
      key: 'enableTools',
      label: '道具の利用を有効にする',
      description:
        '役割の権限で道具（ファイルの読み書き・スキル・途中の投稿）を実行します。DeepSeek などは JSON 操作を使います。コマンドは OS の隔離の中でだけ動かします（macOS と、対応する Windows 11。通信はできません）。作業フォルダの外への書き込みは macOS だけです。',
      type: 'boolean',
      choices: [],
      default: false,
    },
    {
      key: 'operationCheck',
      label: '操作を実行前に確認する',
      description: 'コマンドと PC 全体への書き込みを、依頼に沿うかモデルで確認します。',
      type: 'boolean',
      choices: [],
      default: true,
    },
  ],
  permissionRules: [
    {
      when: 'writeAnywhere',
      requires: ['writeFiles'],
    },
    {
      when: 'runCommands',
      requires: ['readFiles'],
    },
  ],
  leakRisks: [],
  unrestricted: [],
  midRunPost: 'tool',
  folderScope: 'files',
  toolsOption: 'enableTools',
  local: true,
  setup: OLLAMA_SETUP,
};
