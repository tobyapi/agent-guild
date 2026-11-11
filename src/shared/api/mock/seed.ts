// 初期データ（docs/design.md §13）、画面確認用のデモ、復旧モード。
import gptAvatar from '@/shared/assets/gpt-avatar.jpg?inline';
import starter from '@/shared/assets/starter.json';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Agent, AgentTemplate, BootReason } from '@/shared/types/domain';
import { MOCK_LIBRARY_DIRS } from './library';
import { MOCK_BACKENDS } from './seedCatalog';
import { demoDelegation } from './seedDelegation';
import { MOCK_BROKEN_DATA_DIR, MOCK_DEFAULT_DATA_DIR, SEED_IDS } from './seedIds';
import { demoMessages, welcomeMessage } from './seedMessages';
import { roleSkills } from './defaultSkills';
import { seedSkills } from './seedSkills';
import { MOCK_TEMPLATES } from './seedTemplates';
import type { MockState } from './state';

const HOUR_MS = 60 * 60 * 1000;

/** §13 のとおり、テンプレートの既定値から作って差分だけ書く */
type AgentSeed = Pick<Agent, 'id' | 'name' | 'avatar' | 'color' | 'tags' | 'role' | 'personality' | 'tone'> &
  Partial<Agent> & { template: AgentTemplate['id'] };

function templateOf(id: AgentTemplate['id']): AgentTemplate {
  const template = MOCK_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`モックのテンプレート ${id} がありません`);
  return template;
}

const STARTER_AGENT: AgentSeed = { ...starter.agent, id: SEED_IDS.starter, avatar: gptAvatar };

const DEMO_AGENTS: AgentSeed[] = [
  {
    id: SEED_IDS.hal,
    template: 'worker',
    name: 'ハル',
    avatar: '🌱',
    color: '#cb9d2a',
    tags: ['作業者', 'リサーチ'],
    role: 'リサーチと企画の担当',
    personality: '好奇心旺盛で前向き',
    tone: 'フランクな丁寧語',
    backend: 'claude',
    model: 'sonnet',
  },
  {
    id: SEED_IDS.sora,
    template: 'worker',
    name: 'ソラ',
    avatar: '🛠️',
    color: '#22b5e1',
    tags: ['作業者', '実装'],
    role: '実装と検証の担当',
    personality: '寡黙で職人肌',
    tone: '簡潔な常体',
    backend: 'codex',
  },
  {
    id: SEED_IDS.logica,
    template: 'expert',
    name: 'ロジカ',
    avatar: '🧐',
    color: '#7ca2f6',
    tags: ['専門家', 'レビュー'],
    role: '文章と企画のレビュー担当',
    personality: '辛口だが公平',
    tone: '落ち着いた敬語',
    expertise: '文章・企画の論理チェックとレビュー',
    backend: 'claude',
    model: 'sonnet',
    permissions: { ...templateOf('expert').defaults.permissions, runCommands: false },
  },
  {
    id: SEED_IDS.gear,
    template: 'expert',
    name: 'ギア',
    avatar: '⚙️',
    color: '#e28d4f',
    tags: ['専門家', '設計'],
    role: '設計とコードのレビュー担当',
    personality: '理屈っぽい',
    tone: '常体',
    expertise: 'ソフトウェア設計とコードレビュー（保守性・凝集度・テスト容易性）',
    backend: 'codex',
  },
  {
    id: SEED_IDS.kaname,
    template: 'manager',
    name: 'カナメ',
    avatar: '🧭',
    color: '#d285cb',
    tags: ['マネージャー'],
    role: '依頼を分解して割り振る進行役',
    personality: '落ち着いて段取りを組む',
    tone: '丁寧で簡潔な口調',
    backend: 'codex',
  },
];

function toAgent({ template, ...seed }: AgentSeed, index: number, createdAt: number): Agent {
  const { defaults } = templateOf(template);
  return {
    expertise: defaults.expertise,
    backend: 'claude',
    model: '',
    backendOptions: {},
    permissions: { ...defaults.permissions },
    unmentioned: defaults.unmentioned,
    consultable: defaults.consultable,
    canDelegate: defaults.canDelegate,
    autonomyEnabled: defaults.autonomyEnabled,
    autonomyIntervalMin: 60,
    autonomyChannelId: null,
    lastAutonomousAt: null,
    deletedAt: null,
    ...seed,
    createdAt: createdAt + index,
  };
}

/** bootFailure を渡すと復旧モード（データフォルダを開けなかった状態）で起動する */
export function createSeedState(
  now: number,
  bootFailure: Exclude<BootReason, 'none'> | null,
  demo: boolean,
): MockState {
  const createdAt = now - 2 * HOUR_MS;
  const agents = (demo ? DEMO_AGENTS : [STARTER_AGENT]).map((seed, index) => toAgent(seed, index, createdAt));
  const messages = demo ? demoMessages(now) : [welcomeMessage(now)];
  const delegation = demo ? demoDelegation(now, messages.length + 1) : null;
  if (delegation) messages.push(...delegation.messages);
  return {
    boot: bootFailure
      ? {
          state: 'recovery',
          reason: bootFailure,
          dataDir: MOCK_BROKEN_DATA_DIR,
          message: `（モック）${MOCK_BROKEN_DATA_DIR} を開けませんでした`,
          needsSetup: false,
        }
      : { state: 'ok', reason: 'none', dataDir: MOCK_DEFAULT_DATA_DIR, message: '', needsSetup: false },
    me: { name: 'ユーザー', avatar: '🙂', color: '#f0ba5f' },
    agents,
    channels: [
      {
        id: SEED_IDS.lobby,
        name: 'ロビー',
        topic: 'みんなの雑談と相談の場',
        memberIds: [HUMAN_ID, ...agents.map((agent) => agent.id)],
        createdAt,
      },
    ],
    messages,
    attachmentData: {},
    delegations: delegation ? [delegation.delegation] : [],
    skills: demo
      ? seedSkills(createdAt)
      : agents.flatMap((agent) => {
          let index = 0;
          return roleSkills(agent, MOCK_TEMPLATES, () => `default-${agent.id}-${index++}`, createdAt);
        }),
    skillLibraryDirs: demo ? [MOCK_LIBRARY_DIRS.personal, MOCK_LIBRARY_DIRS.team, MOCK_LIBRARY_DIRS.usb] : [],
    backends: structuredClone(MOCK_BACKENDS),
    templates: structuredClone(MOCK_TEMPLATES),
    runtime: { state: 'starting', message: '' },
    storage: bootFailure
      ? { dataDir: MOCK_BROKEN_DATA_DIR, defaultDataDir: MOCK_DEFAULT_DATA_DIR, source: 'settings' }
      : { dataDir: MOCK_DEFAULT_DATA_DIR, defaultDataDir: MOCK_DEFAULT_DATA_DIR, source: 'default' },
    nextSeq: messages.length + 1,
  };
}
