// Codex の画像の生成（image 要求）: 出来上がった PNG の受け取り（モデルが output に保存したもの、なければこのスレッドが
// 生成した最後の PNG）と、失敗の伝え方。道具の設定とスキルの渡し方は codex-image-options.test.ts。
// Codex SDK はモックにし、$CODEX_HOME は一時フォルダにする。
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendError } from './types.ts';
import { codexImageHarness, png, THREAD } from './codex-image.test-support.ts';

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

const draw = async (request = harness.request()): Promise<unknown> =>
  codexAdapter.image?.(request, harness.context()).then(
    () => null,
    (error: unknown) => error,
  );

describe('Codex の image が出来上がった PNG を受け取る', () => {
  it('モデルが output（作業場所の中）に PNG を保存したら、それを使う（生成した画像では上書きしない）', async () => {
    harness.stream('done', async () => {
      await harness.savePng(THREAD, 'exec-a.png', png('generated 1254px'), 1000);
      await writeFile(harness.request().output, png('delivered 64px'));
    });
    expect(await draw()).toBeNull();
    expect(await readFile(harness.request().output)).toEqual(png('delivered 64px'));
  });

  it('保存されなければ、このスレッドのフォルダで最後に保存された PNG を写す（ほかのスレッドの画像は使わない）', async () => {
    await harness.savePng('another-thread', 'exec-z.png', 'other', 3000);
    harness.stream('done', async () => {
      await harness.savePng(THREAD, 'exec-a.png', 'first', 1000);
      await harness.savePng(THREAD, 'exec-b.png', 'second', 2000);
      await writeFile(join(harness.home(), 'generated_images', THREAD, 'notes.txt'), 'x');
    });
    const context = harness.context();
    await codexAdapter.image?.(harness.request(), context);
    expect(await readFile(harness.request().output, 'utf8')).toBe('second');
    expect(context.onActivity).toHaveBeenCalled();
  });

  it('output に PNG でないものが書かれていたら、生成した画像で置き換える', async () => {
    harness.stream('done', async () => {
      await harness.savePng(THREAD, 'exec-a.png', 'generated', 1000);
      await writeFile(harness.request().output, 'not a png');
    });
    expect(await draw()).toBeNull();
    expect(await readFile(harness.request().output, 'utf8')).toBe('generated');
  });

  it('前の実行の output の残りは、始める前に消す（取り違えない）', async () => {
    const { output, workspace } = harness.request();
    await mkdir(workspace, { recursive: true });
    await writeFile(output, png('stale'));
    let seen = true;
    harness.stream('I cannot generate images here.', () => {
      seen = existsSync(output);
      return Promise.resolve();
    });
    expect(await draw()).toBeInstanceOf(BackendError);
    expect(seen).toBe(false);
    expect(existsSync(output)).toBe(false);
  });

  it('画像ができなければ、理由（ChatGPT のログイン）と Codex の返事を添えて失敗する', async () => {
    harness.stream('I cannot generate images here.');
    const failure = await draw();
    expect(failure).toBeInstanceOf(BackendError);
    const { code, message } = failure as BackendError;
    expect(code).toBe('internal');
    expect(message).toContain('ChatGPT');
    expect(message).toContain('I cannot generate images');
    expect(existsSync(harness.request().output)).toBe(false);
  });

  it('スキルの name が不正なら、描かずに bad_request で失敗する', async () => {
    const request = harness.request();
    const failure = await draw({ ...request, skills: [{ ...request.skills[0]!, name: 'Bad Name' }] });
    expect((failure as BackendError).code).toBe('bad_request');
    expect(mock.stream).not.toHaveBeenCalled();
  });
});
