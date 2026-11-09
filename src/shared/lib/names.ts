// エージェント名・プロフィール名の規則（docs/design.md §2 入力規則）。
// クライアントでも事前に検査するが、正はサーバの validation メッセージ。
import { textLength } from './validation';

export const MEMBER_NAME_MAX = 32;

/** 重複の判定に使う正規化（NFKC＋大文字小文字無視） */
export function normalizeName(name: string): string {
  return name.trim().normalize('NFKC').toLowerCase();
}

/**
 * 名前の問題を返す（なければ null）。
 * takenNames は重複してはいけない名前（削除されていない他のエージェントと人間のプロフィール名）。
 */
export function checkMemberName(name: string, takenNames: readonly string[]): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return '名前を入力してください';
  if (textLength(trimmed) > MEMBER_NAME_MAX) return `名前は ${MEMBER_NAME_MAX} 文字以内にしてください`;
  if (/[\s@＠]/.test(trimmed)) return '名前に空白や @ は使えません';
  const normalized = normalizeName(trimmed);
  if (takenNames.some((taken) => normalizeName(taken) === normalized)) return 'その名前はすでに使われています';
  return null;
}
