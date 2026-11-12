// Codex の画像の生成（image 要求）のテストの部品: 一時フォルダの $CODEX_HOME と作業場所、Codex SDK のモックが流す
// 実行の出来事、Codex が保存する画像。Codex SDK のモックそのもの（vi.mock）は各テストファイルに置く。

import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi, type Mock } from 'vitest';
import type { ImageContext, ImageRequest } from './types.ts';

export const THREAD = '01a1ccd1-ac7b-76f1-960a-c502ee62483c';
export const PROMPT = '$ornate-avatar-frame でアイコンの枠を1つ生成して。テーマ: 月夜の薔薇';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG の先頭の8バイトに text を続けたもの（中身の検査はアプリが行うので、ランナーは先頭だけ見る） */
export const png = (text: string): Buffer => Buffer.concat([PNG_SIGNATURE, Buffer.from(text)]);

/** stream は Codex SDK のモックの runStreamed */
export function codexImageHarness(stream: Mock) {
  let home = '';
  let root = '';
  return {
    home: (): string => home,
    /** workspaceName は一時フォルダの中の作業場所の名前 */
    request: (workspaceName = 'work'): ImageRequest => ({
      type: 'image',
      id: 'frame-1',
      backend: 'codex',
      workspace: join(root, workspaceName),
      stateDir: join(root, 'state'),
      systemPrompt: '',
      prompt: PROMPT,
      skills: [
        { name: 'ornate-avatar-frame', description: 'Ornate frames.', body: '# Ornate frame', dir: null, files: [] },
      ],
      output: join(root, workspaceName, 'frame.png'),
    }),
    context: (): ImageContext => ({ signal: new AbortController().signal, onActivity: vi.fn() }),
    /** 実行の出来事（スレッドの開始と最後の返事）。work があれば、実行の途中で行う（画像の保存など） */
    stream(reply: string, work?: () => Promise<void>): void {
      stream.mockImplementation(() =>
        Promise.resolve({
          events: (async function* () {
            yield { type: 'thread.started', thread_id: THREAD };
            await work?.();
            yield { type: 'item.completed', item: { type: 'agent_message', id: '1', text: reply } };
            yield { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } };
          })(),
        }),
      );
    },
    /** Codex の画像の生成が $CODEX_HOME/generated_images/<スレッド>/ に保存した画像（time は更新時刻） */
    async savePng(thread: string, name: string, bytes: string | Buffer, time: number): Promise<void> {
      const dir = join(home, 'generated_images', thread);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), bytes);
      await utimes(join(dir, name), time, time);
    },
    setUp: async (): Promise<void> => {
      vi.clearAllMocks();
      home = await mkdtemp(join(tmpdir(), 'codex-home-'));
      root = await mkdtemp(join(tmpdir(), 'frame-work-'));
      vi.stubEnv('CODEX_HOME', home);
    },
    tearDown: async (): Promise<void> => {
      vi.unstubAllEnvs();
      await rm(home, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    },
  };
}
