import snapshot from '../../../../contracts/ipc/snapshot.json';
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

export const TEMPLATES = snapshot.templates as AgentTemplate[];

export const BACKENDS: BackendInfo[] = [
  {
    id: 'claude',
    label: 'Claude',
    models: [
      {
        id: 'sonnet',
        label: 'Sonnet',
        description: '日々の作業向け',
        efforts: ['low', 'high', 'max'],
        defaultEffort: null,
      },
      { id: 'haiku', label: 'Haiku', description: '', efforts: [], defaultEffort: null },
    ],
    defaultModel: 'sonnet',
    capabilities: allCapabilities,
    status: 'needs_auth',
    statusMessage: '',
    canLogin: true,
    midRunPost: 'tool',
    options: [{ key: 'maxTurns', label: '最大ターン数', description: '', type: 'number', choices: [], default: 30 }],
    permissionRules: [
      { when: 'writeAnywhere', requires: ['writeFiles'] },
      { when: 'runCommands', requires: ['readFiles', 'writeFiles', 'writeAnywhere', 'webFetch', 'webSearch'] },
    ],
    leakRisks: [['readFiles', 'writeAnywhere', 'webFetch']],
  },
  {
    id: 'codex',
    label: 'Codex',
    models: [],
    defaultModel: '',
    capabilities: allCapabilities,
    status: 'ready',
    statusMessage: '',
    canLogin: false,
    midRunPost: 'text',
    options: [],
    permissionRules: [
      { when: 'writeFiles', requires: ['runCommands'] },
      { when: 'writeAnywhere', requires: ['writeFiles', 'webFetch'] },
    ],
    leakRisks: [['webFetch']],
  },
];

/** テスト用の保存済みエージェント */
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
