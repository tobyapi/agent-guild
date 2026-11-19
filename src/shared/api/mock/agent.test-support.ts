import type { AgentInput } from '@/shared/types/domain';

export const allowAll = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: false,
  writeFiles: true,
  writeAnywhere: true,
  runCommands: true,
  skills: true,
};

export const agentInput = (overrides: Partial<AgentInput> = {}): AgentInput => ({
  name: 'ミライ',
  avatar: '🔭',
  color: '#8cc3fc',
  frame: '',
  tags: ['作業者'],
  role: '調査',
  voice: { mode: 'auto', intensity: 'weak' },
  personality: '',
  tone: '',
  expertise: '',
  backend: 'claude',
  model: '',
  backendOptions: { maxTurns: 10, unknownKey: true },
  unmentioned: 'answer',
  consultable: false,
  canDelegate: false,
  autonomyEnabled: false,
  autonomyIntervalMin: 60,
  autonomyChannelId: null,
  ...overrides,
});
