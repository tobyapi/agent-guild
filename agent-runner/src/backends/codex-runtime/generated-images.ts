// Codex の画像の生成（image_gen）が保存した PNG の場所。Codex は描いた画像を $CODEX_HOME/generated_images/<スレッドの ID>/
// に保存する（exec の JSON の出来事には画像の項目がなく、画像そのものは渡ってこない）。スレッドの ID は実行ごとに違うので、
// このフォルダを見れば、ほかの実行（エージェントの会話など）が描いた画像を取り違えない。
// モデルが道具で保存した PNG（request.output）があれば、そちらを使う（isPngFile）。

import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** そのスレッドが描いた画像を置くフォルダ */
export function generatedImagesDir(codexHome: string, threadId: string): string {
  return join(codexHome, 'generated_images', threadId);
}

/** フォルダの中で最後に書かれた PNG（なければ null。フォルダがなくても null） */
export async function newestPng(dir: string): Promise<string | null> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  let newest: { path: string; time: number } | null = null;
  for (const name of names.filter((entry) => entry.toLowerCase().endsWith('.png'))) {
    const path = join(dir, name);
    const info = await stat(path).catch(() => null);
    if (info?.isFile() && (newest === null || info.mtimeMs > newest.time)) newest = { path, time: info.mtimeMs };
  }
  return newest?.path ?? null;
}

/** PNG の先頭の8バイト */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** path が PNG のファイルか（先頭の8バイトで見る。中身の検査はアプリが取り込むときに行う。なければ false） */
export async function isPngFile(path: string): Promise<boolean> {
  const file = await open(path, 'r').catch(() => null);
  if (file === null) return false;
  try {
    const head = Buffer.alloc(PNG_SIGNATURE.length);
    const { bytesRead } = await file.read(head, 0, head.length, 0);
    return bytesRead === head.length && head.equals(PNG_SIGNATURE);
  } catch {
    return false;
  } finally {
    await file.close();
  }
}
