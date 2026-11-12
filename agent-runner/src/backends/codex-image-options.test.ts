// Codex の画像の生成（image 要求）の道具とスキル: スキルの手順を行える道具（画像の生成・シェル・画像を見る）だけを使わせ、
// 書き込みは作業場所の中だけにすること。添えたスキルを作業場所に置き、依頼の中の呼び出しをその SKILL.md へのリンクに
// すること（リンクに書けないパスなら、Codex の差し込みと同じ形で本文を置くこと）。Codex SDK はモックにする。
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codexImageHarness, PROMPT, THREAD } from './codex-image.test-support.ts';
import { imageThreadOptions } from './codex-runtime/image-options.ts';

const mock = vi.hoisted(() => ({ construct: vi.fn(), start: vi.fn(), stream: vi.fn() }));
vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    constructor(options: unknown) {
      mock.construct(options);
    }
    startThread(options: unknown) {
      mock.start(options);
      return { runStreamed: mock.stream };
    }
  },
}));
vi.mock('./codex-runtime/executable.ts', () => ({
  findCodex: () => ({ path: '/bin/codex', pathDirs: [] }),
  codexNotFound: () => 'missing',
}));
import { codexAdapter } from './codex.ts';

const harness = codexImageHarness(mock.stream);
beforeEach(harness.setUp);
afterEach(harness.tearDown);

const SKILL_MD = '---\nname: ornate-avatar-frame\ndescription: "Ornate frames."\n---\n\n# Ornate frame\n';

describe('Codex の image の道具', () => {
  it('画像の生成・シェル・画像を見る道具を使わせ、書き込みは作業場所だけ（ネットワーク・Web・アプリなし）', async () => {
    harness.stream('done', () => harness.savePng(THREAD, 'exec-a.png', 'png', 1000));
    await codexAdapter.image?.(harness.request(), harness.context());
    const { config } = mock.construct.mock.calls[0]?.[0] as { config: Record<string, unknown> };
    expect(config).toMatchObject({
      project_doc_max_bytes: 0,
      features: {
        image_generation: true,
        shell_tool: true,
        view_image: true,
        apps: false,
        plugins: false,
        multi_agent: false,
        browser_use: false,
        computer_use: false,
        in_app_browser: false,
      },
      sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
    });
    expect(config).not.toHaveProperty('developer_instructions');
    expect(mock.start.mock.calls[0]?.[0]).toMatchObject({
      workingDirectory: harness.request().workspace,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      webSearchMode: 'disabled',
      networkAccessEnabled: false,
    });
    expect(mock.start.mock.calls[0]?.[0]).not.toHaveProperty('additionalDirectories');
  });

  it('システムプロンプトがあれば developer_instructions で渡す', async () => {
    harness.stream('done', () => harness.savePng(THREAD, 'exec-a.png', 'png', 1000));
    await codexAdapter.image?.({ ...harness.request(), systemPrompt: 'You paint.' }, harness.context());
    expect(mock.construct.mock.calls[0]?.[0]).toMatchObject({ config: { developer_instructions: 'You paint.' } });
  });

  it('モデルは一覧の既定で、推論の深さは選べれば low、選べなければモデルの既定', () => {
    const spec = { id: 'gpt-x', label: 'x', description: '', efforts: ['low', 'high'], defaultEffort: 'high' };
    const low = imageThreadOptions('/w', { models: [spec], defaultModel: 'gpt-x' });
    expect(low).toMatchObject({ model: 'gpt-x', modelReasoningEffort: 'low' });
    const noLow = { models: [{ ...spec, efforts: ['medium', 'high'] }], defaultModel: 'gpt-x' };
    expect(imageThreadOptions('/w', noLow)).toMatchObject({ model: 'gpt-x', modelReasoningEffort: 'high' });
  });
});

describe('Codex の image のスキル', () => {
  it('作業場所の .agents/skills/ に置き（前の残りは消す）、呼び出しをその SKILL.md へのリンクにする', async () => {
    const skills = join(harness.request().workspace, '.agents', 'skills');
    await mkdir(join(skills, 'stale'), { recursive: true });
    let seen = '';
    harness.stream('done', async () => {
      seen = await readFile(join(skills, 'ornate-avatar-frame', 'SKILL.md'), 'utf8');
      await harness.savePng(THREAD, 'exec-a.png', 'png', 1000);
    });
    const twice = `${PROMPT}（$ornate-avatar-frame の手順で）`;
    await codexAdapter.image?.({ ...harness.request(), prompt: twice }, harness.context());
    expect(seen).toBe(SKILL_MD);
    expect(existsSync(join(skills, 'stale'))).toBe(false);
    // 利用者が Codex で頼むときと同じリンク。Codex がパスでスキルを決めて差し込むので、本文は足さない（最初の1つだけ直す）
    const path = join(skills, 'ornate-avatar-frame', 'SKILL.md');
    expect(mock.stream.mock.calls[0]?.[0]).toBe(
      twice.replace('$ornate-avatar-frame', `[$ornate-avatar-frame](${path})`),
    );
  });

  it('パスに空白があってリンクに書けなければ、本文を Codex の差し込みと同じ形で置き、呼び出しは名前だけにする', async () => {
    harness.stream('done', () => harness.savePng(THREAD, 'exec-a.png', 'png', 1000));
    const request = harness.request('my work');
    await codexAdapter.image?.(request, harness.context());
    const path = join(request.workspace, '.agents', 'skills', 'ornate-avatar-frame', 'SKILL.md');
    expect(mock.stream.mock.calls[0]?.[0]).toBe(
      `<skill>\n<name>ornate-avatar-frame</name>\n<path>${path}</path>\n${SKILL_MD}</skill>\n\n` +
        PROMPT.replace('$ornate-avatar-frame', 'ornate-avatar-frame'),
    );
  });

  it('呼び出しのないスキルは置くだけで、依頼の本文は変えない（スキルがないときも）', async () => {
    harness.stream('done', () => harness.savePng(THREAD, 'exec-a.png', 'png', 1000));
    await codexAdapter.image?.({ ...harness.request(), prompt: 'Paint a frame.' }, harness.context());
    await codexAdapter.image?.({ ...harness.request(), skills: [] }, harness.context());
    expect(mock.stream.mock.calls.map((call: unknown[]) => call[0])).toEqual(['Paint a frame.', PROMPT]);
  });
});
