import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { objectOf } from '@/shared/types/schema';
import { snapshotSchema } from '@/shared/types/schemas/system';
import { HUMAN_ID } from '@/shared/types/domain';
import type { AgentInput } from '@/shared/types/domain';
import { createMockTransport } from './index';
import { SEED_IDS } from './seedIds';
import { createHarness } from './harness.test-support';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const allowAll = {
  webSearch: true,
  webFetch: true,
  readFiles: true,
  readAnywhere: false,
  writeFiles: true,
  writeAnywhere: true,
  runCommands: true,
  skills: true,
};

const agentInput = (overrides: Partial<AgentInput> = {}): AgentInput => ({
  name: 'ミライ',
  avatar: '🔭',
  color: '#8cc3fc',
  tags: ['作業者'],
  role: '調査',
  personality: '',
  tone: '',
  expertise: '',
  backend: 'claude',
  model: '',
  backendOptions: { maxTurns: 10, unknownKey: true },
  permissions: allowAll,
  unmentioned: 'answer',
  consultable: false,
  canDelegate: false,
  autonomyEnabled: false,
  autonomyIntervalMin: 60,
  autonomyChannelId: null,
  ...overrides,
});

describe('モックのコマンド', () => {
  it('get_snapshot は契約に合い、ロビーに画像アバターを持つ作業者1人を返す', async () => {
    const transport = createMockTransport({ latencyMs: 0, runtimeStartupMs: 0 });
    const snapshot = await transport.invoke('get_snapshot', {});
    expect(objectOf(snapshotSchema)(snapshot, 'snapshot')).toEqual([]);
    expect(snapshot.agents).toMatchObject([
      {
        id: SEED_IDS.starter,
        name: '白龙娘',
        tags: ['作業者', 'リサーチ'],
        unmentioned: 'answer',
        canDelegate: false,
        backend: 'codex',
        model: '',
      },
    ]);
    expect(snapshot.agents[0]?.avatar).toMatch(/^data:image\/jpeg;base64,\/9j\//);
    expect(snapshot.templates.map((template) => template.label)).toEqual([
      '作業者',
      '発想役',
      '専門家',
      'マネージャー',
    ]);
    expect(snapshot.channels).toMatchObject([{ name: 'ロビー', memberIds: [HUMAN_ID, SEED_IDS.starter] }]);
    expect(snapshot.backends.find((backend) => backend.id === 'codex')?.status).toBe('needs_auth');
    const messages = await transport.invoke('list_messages', { channelId: SEED_IDS.lobby, beforeSeq: null, limit: 20 });
    expect(messages).toMatchObject([{ kind: 'system' }]);
    expect(messages[0]?.content).toContain('白龙娘');
  });

  it('list_messages は beforeSeq で古いほうへページングし、seq の昇順で返す', async () => {
    const mock = await createHarness();
    const latest = await mock.transport.invoke('list_messages', {
      channelId: SEED_IDS.lobby,
      beforeSeq: null,
      limit: 3,
    });
    expect(latest.map((message) => message.seq)).toEqual([10, 11, 12]);
    const older = await mock.transport.invoke('list_messages', { channelId: SEED_IDS.lobby, beforeSeq: 10, limit: 3 });
    expect(older.map((message) => message.seq)).toEqual([7, 8, 9]);
  });

  it('create_agent: フラグなしの同名チャンネルには参加しない', async () => {
    const mock = await createHarness();
    await mock.transport.invoke('delete_channel', { id: SEED_IDS.lobby });
    const channel = await mock.transport.invoke('create_channel', { name: 'ロビー', topic: '', memberIds: [] });
    await mock.transport.invoke('create_agent', { input: agentInput() });
    const snapshot = await mock.transport.invoke('get_snapshot', {});
    expect(snapshot.channels.find((entry) => entry.id === channel.id)?.memberIds).toEqual([HUMAN_ID]);
  });

  it('create_agent: 名前を変えたフラグ付きロビーへ一度参加し、削除後も作成できる', async () => {
    const mock = await createHarness();
    await mock.transport.invoke('update_channel', { id: SEED_IDS.lobby, name: 'Lounge', topic: '' });
    const before = await mock.transport.invoke('get_snapshot', {});
    const created = await mock.transport.invoke('create_agent', { input: agentInput() });
    const after = await mock.transport.invoke('get_snapshot', {});
    expect(after.channels.find((channel) => channel.id === SEED_IDS.lobby)?.memberIds).toEqual([
      ...before.channels.find((channel) => channel.id === SEED_IDS.lobby)!.memberIds,
      created.id,
    ]);
    expect(after.agents.filter((agent) => agent.id !== created.id)).toEqual(before.agents);
    expect(after.channels.filter((channel) => channel.id !== SEED_IDS.lobby)).toEqual(
      before.channels.filter((channel) => channel.id !== SEED_IDS.lobby),
    );
    const messageQuery = { channelId: SEED_IDS.lobby, beforeSeq: null, limit: 100 };
    const messages = await mock.transport.invoke('list_messages', messageQuery);
    expect(messages.filter((message) => message.content === 'ミライ がチャンネルに参加しました')).toHaveLength(1);
    await mock.transport.invoke('add_channel_member', { channelId: SEED_IDS.lobby, memberId: created.id });
    expect((await mock.transport.invoke('get_snapshot', {})).channels).toEqual(after.channels);
    expect(await mock.transport.invoke('list_messages', messageQuery)).toEqual(messages);
    await mock.transport.invoke('delete_channel', { id: SEED_IDS.lobby });
    await expect(
      mock.transport.invoke('create_agent', { input: agentInput({ name: '次の新人' }) }),
    ).resolves.toMatchObject({ name: '次の新人' });
  });

  it('create_agent: 名前の重複は validation。未知の設定キーは捨て、タグの重複はまとめる', async () => {
    const mock = await createHarness();
    const created = await mock.transport.invoke('create_agent', {
      input: agentInput({ name: 'はる', tags: [' リサーチ ', 'りさーち', 'Review', 'review'] }),
    });
    expect(created.backendOptions).toEqual({ maxTurns: 10 });
    expect(created.tags).toEqual(['リサーチ', 'りさーち', 'Review']);
    await expect(mock.transport.invoke('create_agent', { input: agentInput({ name: 'ハル' }) })).rejects.toMatchObject({
      code: 'validation',
      field: 'name',
    });
  });

  it('create_agent: 推論の深さはモデルで選べるものだけ（選べなければ backendOptions の validation）', async () => {
    const mock = await createHarness();
    const chosen = agentInput({ model: 'opus', backendOptions: { effort: 'max' } });
    expect((await mock.transport.invoke('create_agent', { input: chosen })).backendOptions).toEqual({ effort: 'max' });
    const haiku = agentInput({ name: 'ミナ', model: 'claude-haiku-4-5-20251001', backendOptions: { effort: 'max' } });
    await expect(mock.transport.invoke('create_agent', { input: haiku })).rejects.toMatchObject({
      field: 'backendOptions',
    });
  });

  it('create_agent: タグを検証し、権限は個別の入力にかかわらず役割で固定する', async () => {
    const mock = await createHarness();
    const badTag = agentInput({ tags: ['#設計'] });
    await expect(mock.transport.invoke('create_agent', { input: badTag })).rejects.toMatchObject({ field: 'tags' });
    const codex = agentInput({
      backend: 'codex',
      backendOptions: {},
      permissions: { ...allowAll, webFetch: false, runCommands: false },
    });
    expect((await mock.transport.invoke('create_agent', { input: codex })).permissions).toEqual(allowAll);
  });

  it('delete_agent は論理削除（一覧には残り、チャンネルからは外れる）', async () => {
    const mock = await createHarness();
    await mock.transport.invoke('delete_agent', { id: SEED_IDS.sora });
    const snapshot = await mock.transport.invoke('get_snapshot', {});
    expect(snapshot.agents.find((agent) => agent.id === SEED_IDS.sora)?.deletedAt).not.toBeNull();
    expect(snapshot.channels[0]?.memberIds).not.toContain(SEED_IDS.sora);
  });

  it('save_skill は名前を変換せずに検証し、重複は conflict、保存すると skills-changed', async () => {
    const mock = await createHarness();
    const input = { id: null, agentId: SEED_IDS.logica, name: 'Bad Name', description: '説明', body: '' };
    await expect(mock.transport.invoke('save_skill', { input })).rejects.toMatchObject({ code: 'validation' });
    const duplicate = { ...input, name: 'review-checklist' };
    await expect(mock.transport.invoke('save_skill', { input: duplicate })).rejects.toMatchObject({ code: 'conflict' });
    await mock.transport.invoke('save_skill', { input: { ...input, name: 'tone-check' } });
    await mock.settle();
    expect(mock.skillsChanged).toEqual([SEED_IDS.logica]);
  });

  it('change_data_dir: copy で移動先にデータがあれば conflict、open なら再起動する', async () => {
    const mock = await createHarness();
    const path = await mock.transport.invoke('choose_folder', {});
    expect(path).not.toBeNull();
    await expect(mock.transport.invoke('change_data_dir', { path: path ?? '', mode: 'copy' })).rejects.toMatchObject({
      code: 'conflict',
    });
    await mock.transport.invoke('change_data_dir', { path: path ?? '', mode: 'open' });
    await mock.settle();
    expect(mock.restart).toHaveBeenCalledOnce();
  });

  it('初回起動なら needsSetup。complete_setup で終える', async () => {
    const mock = await createHarness({ firstRun: true });
    await expect(mock.transport.invoke('get_boot_status', {})).resolves.toMatchObject({
      state: 'ok',
      needsSetup: true,
    });
    await mock.transport.invoke('complete_setup', {});
    await expect(mock.transport.invoke('get_boot_status', {})).resolves.toMatchObject({ needsSetup: false });
  });

  it('復旧モードでは許されたコマンドだけが動き、ほかは unavailable', async () => {
    const mock = await createHarness({ bootFailure: 'missing' });
    await expect(mock.transport.invoke('get_boot_status', {})).resolves.toMatchObject({
      state: 'recovery',
      reason: 'missing',
    });
    await expect(mock.transport.invoke('get_snapshot', {})).rejects.toMatchObject({ code: 'unavailable' });
    await expect(mock.transport.invoke('get_storage_info', {})).resolves.toMatchObject({ source: 'settings' });
  });
});
