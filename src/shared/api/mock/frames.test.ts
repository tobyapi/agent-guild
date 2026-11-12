// モックのアイコンの枠: 生成（枠の生成を申告する使える AI だけ・説明は必須。画像の枠になる）・画像の読み出し・取り消し・
// 削除で選んでいたメンバーが枠なしに戻ること。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAME_GENERATION_MS } from './handlers/frames';
import { createHarness } from './harness.test-support';
import type { MockHarness } from './harness.test-support';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** 枠の生成を申告するモックのバックエンド（codex。最初はログイン待ち）を再確認して、使える状態にする */
async function signInPainter(mock: MockHarness) {
  const refreshing = mock.transport.invoke('refresh_backends', {});
  await vi.advanceTimersByTimeAsync(5000);
  await refreshing;
}

async function generate(mock: MockHarness, description = '月夜の薔薇と鎖') {
  const pending = mock.transport.invoke('generate_avatar_frame', { backendId: 'codex', description, name: '' });
  await vi.advanceTimersByTimeAsync(FRAME_GENERATION_MS);
  return pending;
}

async function reject(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('失敗するはず');
    },
    (error: unknown) => error,
  );
}

describe('モックのアイコンの枠', () => {
  it('生成した画像の枠を保存し、スナップショットに載せる（絵は get_frame_image で取る）', async () => {
    const mock = await createHarness();
    await signInPainter(mock);
    const frame = await generate(mock);
    expect(frame.id.startsWith('custom:')).toBe(true);
    expect(frame).toMatchObject({ name: '月夜の薔薇と鎖', kind: 'png' });
    expect('svg' in frame).toBe(false);
    const snapshot = await mock.transport.invoke('get_snapshot', {});
    expect(snapshot.frames).toEqual([frame]);
    const image = await mock.transport.invoke('get_frame_image', { id: frame.id });
    expect(image.startsWith('data:image/png;base64,')).toBe(true);
    const missing = mock.transport.invoke('get_frame_image', { id: 'custom:none' });
    expect(await reject(missing)).toMatchObject({ code: 'not_found' });
  });

  it('説明が空・使えない AI・枠の生成を申告しない AI は validation で拒む', async () => {
    const mock = await createHarness();
    const signedOut = mock.transport.invoke('generate_avatar_frame', {
      backendId: 'codex',
      description: '鎖',
      name: '',
    });
    expect(await reject(signedOut)).toMatchObject({ code: 'validation', field: 'backendId' });
    await signInPainter(mock);
    const empty = mock.transport.invoke('generate_avatar_frame', { backendId: 'codex', description: ' ', name: '' });
    expect(await reject(empty)).toMatchObject({ code: 'validation', field: 'description' });
    const unknown = mock.transport.invoke('generate_avatar_frame', { backendId: 'none', description: '鎖', name: '' });
    expect(await reject(unknown)).toMatchObject({ code: 'validation', field: 'backendId' });
    const plain = mock.transport.invoke('generate_avatar_frame', { backendId: 'claude', description: '鎖', name: '' });
    const refused = await reject(plain);
    expect(refused).toMatchObject({ code: 'validation', field: 'backendId' });
    expect(String((refused as { message?: unknown }).message)).toContain('生成できません');
  });

  it('生成中に取り消すと runtime で失敗し、何も足さない', async () => {
    const mock = await createHarness();
    await signInPainter(mock);
    const pending = reject(
      mock.transport.invoke('generate_avatar_frame', { backendId: 'codex', description: '鎖', name: '' }),
    );
    await vi.advanceTimersByTimeAsync(10);
    await mock.transport.invoke('cancel_avatar_frame_generation', {});
    expect(await pending).toMatchObject({ code: 'runtime' });
    expect((await mock.transport.invoke('get_snapshot', {})).frames).toEqual([]);
  });

  it('消すと、その枠を選んでいたメンバーは枠なしに戻る', async () => {
    const mock = await createHarness();
    await signInPainter(mock);
    const frame = await generate(mock);
    const me = (await mock.transport.invoke('get_snapshot', {})).me;
    await mock.transport.invoke('update_profile', { profile: { ...me, frame: frame.id } });
    await mock.transport.invoke('delete_avatar_frame', { id: frame.id });
    const snapshot = await mock.transport.invoke('get_snapshot', {});
    expect(snapshot.me.frame).toBe('');
    expect(snapshot.frames).toEqual([]);
    expect(await reject(mock.transport.invoke('delete_avatar_frame', { id: frame.id }))).toMatchObject({
      code: 'not_found',
    });
  });

  it('形の合わない枠の ID は validation（field: frame）', async () => {
    const mock = await createHarness();
    const me = (await mock.transport.invoke('get_snapshot', {})).me;
    const bad = mock.transport.invoke('update_profile', { profile: { ...me, frame: 'https://example.com' } });
    expect(await reject(bad)).toMatchObject({ code: 'validation', field: 'frame' });
  });
});
