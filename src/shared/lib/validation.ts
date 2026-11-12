// フォームの検証で共通に使う小さな規則。メッセージはいまの言語で返す。
import { t } from './i18n';

export interface TextRule {
  /** 表示名（例: "話題"） */
  label: string;
  required?: boolean;
  max?: number;
}

/** 文字数はコードポイントで数える（Rust 側の chars().count() と同じ） */
export function textLength(value: string): number {
  return Array.from(value).length;
}

/** 問題があればエラーメッセージ、なければ null */
export function checkText(value: string, rule: TextRule): string | null {
  const trimmed = value.trim();
  if (rule.required === true && trimmed === '') return t('textRequired', { label: rule.label });
  if (rule.max !== undefined && textLength(trimmed) > rule.max) {
    return t('textTooLong', { label: rule.label, max: rule.max });
  }
  return null;
}

/** エラーのないフィールドを取り除き、エラーがひとつもなければ null を返す */
export function compactErrors<K extends string>(errors: Record<K, string | null>): Partial<Record<K, string>> | null {
  const entries = Object.entries(errors).filter((entry): entry is [K, string] => typeof entry[1] === 'string');
  return entries.length === 0 ? null : (Object.fromEntries(entries) as Partial<Record<K, string>>);
}
