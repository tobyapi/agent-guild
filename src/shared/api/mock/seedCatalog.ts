// モックの「ランナーが申告するもの」（contracts/ipc/snapshot.json に合わせる）。テンプレートの表は seedTemplates.ts。
// 汎用フォームの見た目を確かめられるよう、設定項目は4つの型（number / boolean / select / string）をそろえる。
import type { BackendInfo } from '@/shared/types/domain';
import { CLAUDE_SETUP, CODEX_SETUP } from './seedBackendSetup';
import { MOCK_OLLAMA } from './seedOllama';

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

export const MOCK_BACKENDS: BackendInfo[] = [
  {
    id: 'claude',
    label: 'Claude',
    models: [
      {
        id: 'opus',
        label: 'Opus 5.5',
        description: 'Opus 5.5 · 難しい作業向け',
        efforts: EFFORTS,
        defaultEffort: null,
      },
      {
        id: 'sonnet',
        label: 'Sonnet 5.5',
        description: 'Sonnet 5.5 · 日々の作業向け',
        efforts: EFFORTS,
        defaultEffort: null,
      },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', description: '', efforts: [], defaultEffort: null },
    ],
    defaultModel: 'sonnet',
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
    leakRisks: [
      ['readFiles', 'writeAnywhere', 'webFetch'],
      ['readFiles', 'readAnywhere', 'webFetch'],
    ],
    unrestricted: [],
    midRunPost: 'tool',
    folderScope: null,
    toolsOption: null,
    local: false,
    frameGeneration: false,
    setup: CLAUDE_SETUP,
  },
  {
    id: 'codex',
    label: 'Codex',
    models: [
      {
        id: 'gpt-6.1-sol',
        label: 'GPT-6.1-Sol',
        description: 'Latest workhorse model for coding and everyday work.',
        efforts: [...EFFORTS, 'ultra'],
        defaultEffort: 'low',
      },
      { id: 'gpt-6-luna', label: 'GPT-6-Luna', description: '', efforts: EFFORTS, defaultEffort: 'medium' },
    ],
    defaultModel: 'gpt-6.1-sol',
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
    status: 'needs_auth',
    statusMessage: 'ターミナルで codex login を実行してから「再確認」を押してください。',
    options: [
      {
        key: 'verbosity',
        label: '返答の詳しさ',
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
    leakRisks: [['webFetch']],
    unrestricted: ['readAnywhere', 'writeFiles', 'runCommands'],
    midRunPost: 'text',
    folderScope: 'sandbox',
    toolsOption: null,
    local: false,
    frameGeneration: true,
    setup: CODEX_SETUP,
  },
  MOCK_OLLAMA,
];
