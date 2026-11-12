// エージェント名・プロフィール名の規則（docs/design.md §2 入力規則）。
// クライアントでも事前に検査するが、正はサーバの validation メッセージ。
import { textLength } from './validation';
import { t } from './i18n';

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
  if (trimmed === '') return t('nameRequired');
  if (textLength(trimmed) > MEMBER_NAME_MAX) return t('nameTooLong', { max: MEMBER_NAME_MAX });
  if (/[\s@＠]/.test(trimmed)) return t('nameInvalidChars');
  const normalized = normalizeName(trimmed);
  if (takenNames.some((taken) => normalizeName(taken) === normalized)) return t('nameTaken');
  return null;
}
