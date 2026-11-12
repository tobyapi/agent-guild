// 選べる言語の一覧と、OS（ブラウザ）の言語からの選び方。
import type { Language } from '@/shared/types/domain';

export interface LanguageOption {
  value: Language;
  /** その言語自身での名前（どの言語の画面でも同じに出す） */
  label: string;
}

export const LANGUAGES: readonly LanguageOption[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'ko', label: '한국어' },
];

/** 何も分からないときの言語（これまでの版はすべて日本語だった） */
export const DEFAULT_LANGUAGE: Language = 'ja';

export function parseLanguage(value: unknown): Language | null {
  return LANGUAGES.find((option) => option.value === value)?.value ?? null;
}

/** BCP 47 のタグ（例: "zh-TW"・"en-US"）を、選べる言語に寄せる。合うものがなければ null */
export function languageOfTag(tag: string): Language | null {
  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) {
    const traditional = ['hant', '-tw', '-hk', '-mo'].some((part) => lower.includes(part));
    return traditional ? 'zh-Hant' : 'zh-Hans';
  }
  const primary = lower.split('-')[0];
  return parseLanguage(primary);
}

/** 好みの言語の並び（navigator.languages）から最初に合うもの。なければ英語 */
export function detectLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const language = languageOfTag(tag);
    if (language !== null) return language;
  }
  return 'en';
}
