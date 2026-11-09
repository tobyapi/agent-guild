// agents/model のテスト用の値（契約の実例 contracts/ipc/snapshot.json に合わせる）。
import type { Agent, AgentTemplate, BackendInfo } from '@/shared/types/domain';

export const allCapabilities = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  writeFiles: true,
  writeAnywhere: true,
  runCommands: true,
  skills: true,
};

export const TEMPLATES: AgentTemplate[] = [
  {
    id: 'worker',
    label: '作業者',
    description: '',
    accent: 'worker',
    defaults: {
      tags: ['作業者'],
      role: '頼まれた作業を手を動かして進める',
      expertise: '',
      permissions: { ...allCapabilities, writeAnywhere: false, runCommands: false },
      unmentioned: 'answer',
      consultable: false,
      canDelegate: false,
      autonomyEnabled: false,
    },
  },
  {
    id: 'expert',
    label: '専門家',
    description: '',
    accent: 'expert',
    defaults: {
      tags: ['専門家'],
      role: '専門分野の相談とレビューに答える',
      expertise: '',
      permissions: { ...allCapabilities, writeFiles: false, writeAnywhere: false, runCommands: false },
      unmentioned: 'fallback',
      consultable: true,
      canDelegate: false,
      autonomyEnabled: false,
    },
  },
];

export const BACKENDS: BackendInfo[] = [
  {
    id: 'claude',
    label: 'Claude',
    modelSuggestions: ['sonnet'],
    defaultModel: 'sonnet',
    capabilities: allCapabilities,
    status: 'needs_auth',
    statusMessage: '',
    canLogin: true,
    options: [{ key: 'maxTurns', label: '最大ターン数', description: '', type: 'number', choices: [], default: 30 }],
    permissionRules: [
      { when: 'writeAnywhere', requires: ['writeFiles'] },
      { when: 'runCommands', requires: ['readFiles', 'writeFiles', 'writeAnywhere', 'webFetch', 'webSearch'] },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    modelSuggestions: [],
    defaultModel: '',
    capabilities: allCapabilities,
    status: 'ready',
    statusMessage: '',
    canLogin: false,
    options: [],
    permissionRules: [
      { when: 'writeFiles', requires: ['runCommands'] },
      { when: 'writeAnywhere', requires: ['writeFiles', 'webFetch'] },
    ],
  },
];

/** テスト用のエージェント（作業者のテンプレートの既定値） */
export function agentFixture(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    name: 'ハル',
    avatar: '🌱',
    color: '#cb9d2a',
    tags: ['作業者'],
    role: '',
    personality: '',
    tone: '',
    expertise: '',
    backend: 'claude',
    model: '',
    backendOptions: {},
    permissions: { ...allCapabilities, writeAnywhere: false, runCommands: false },
    unmentioned: 'answer',
    consultable: false,
    canDelegate: false,
    autonomyEnabled: false,
    autonomyIntervalMin: 60,
    autonomyChannelId: null,
    lastAutonomousAt: null,
    createdAt: 0,
    deletedAt: null,
    ...overrides,
  };
}
