// モックの「ランナーが申告するもの」（contracts/ipc/snapshot.json に合わせる）。テンプレートの表は seedTemplates.ts。
// 汎用フォームの見た目を確かめられるよう、設定項目は4つの型（number / boolean / select / string）をそろえる。
import type { BackendInfo } from '@/shared/types/domain';

export const MOCK_BACKENDS: BackendInfo[] = [
  {
    id: 'claude',
    label: 'Claude',
    modelSuggestions: ['sonnet', 'opus', 'haiku'],
    defaultModel: 'sonnet',
    capabilities: { webSearch: true, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: true, runCommands: true, skills: true },
    status: 'ready',
    statusMessage: '',
    options: [
      {
        key: 'maxTurns',
        label: '最大ターン数',
        description: '1回の返答で使うツール呼び出しの上限',
        type: 'number',
        choices: [],
        default: 30,
      },
      {
        key: 'extendedThinking',
        label: 'じっくり考える',
        description: '返答の前に長めに考える（遅くなる）',
        type: 'boolean',
        choices: [],
        default: false,
      },
    ],
    permissionRules: [
      { when: 'writeAnywhere', requires: ['writeFiles'] },
      { when: 'runCommands', requires: ['readFiles', 'writeFiles', 'writeAnywhere', 'webFetch', 'webSearch'] },
    ],
    canLogin: true,
  },
  {
    id: 'codex',
    label: 'Codex',
    modelSuggestions: [],
    defaultModel: '',
    capabilities: { webSearch: true, webFetch: false, readFiles: true, writeFiles: true, writeAnywhere: true, runCommands: true, skills: true },
    status: 'needs_auth',
    statusMessage: 'ターミナルで codex login を実行してから「再確認」を押してください。',
    options: [
      {
        key: 'reasoningEffort',
        label: '推論の深さ',
        description: '',
        type: 'select',
        choices: ['low', 'medium', 'high'],
        default: 'medium',
      },
      {
        key: 'profile',
        label: '設定プロファイル',
        description: 'Codex の config.toml のプロファイル名',
        type: 'string',
        choices: [],
        default: null,
      },
    ],
    permissionRules: [
      { when: 'writeFiles', requires: ['runCommands'] },
      { when: 'writeAnywhere', requires: ['writeFiles', 'webFetch'] },
    ],
    canLogin: false,
  },
];
