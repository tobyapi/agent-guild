// 認証状態の確認（probe）に使う部品。資格情報は「存在」だけを見て、中身は決して読まない。

import { stat } from 'node:fs/promises';

/** 環境変数のどれかが定義されていれば、その名前（値は見ない） */
export function definedEnv(names: readonly string[]): string | undefined {
  return names.find((name) => name in process.env);
}

/** ファイルがあるか（開かない・読まない） */
export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
