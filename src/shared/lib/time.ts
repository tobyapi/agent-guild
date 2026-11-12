// 日時の表示。すべてローカル時刻で扱う。書式はいまの表示の言語に合わせる。
import { currentLanguage } from '@/shared/i18n';
import type { Language } from '@/shared/types/domain';
import { t } from './i18n';

/** Intl に渡すロケール（日本語は従来どおり ja-JP） */
const LOCALES: Readonly<Record<Language, string>> = {
  ja: 'ja-JP',
  en: 'en-US',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  ko: 'ko-KR',
};

const FORMAT_OPTIONS = {
  time: { hour: '2-digit', minute: '2-digit' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
  day: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

type FormatKind = keyof typeof FORMAT_OPTIONS;

/** 作るのが重いので、言語と書式の組ごとに使い回す */
const formats = new Map<string, Intl.DateTimeFormat>();

function formatter(kind: FormatKind): Intl.DateTimeFormat {
  const language = currentLanguage();
  const cacheKey = `${language}:${kind}`;
  let format = formats.get(cacheKey);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALES[language], FORMAT_OPTIONS[kind]);
    formats.set(cacheKey, format);
  }
  return format;
}

/** 例: "09:05" */
export function formatTime(ms: number): string {
  return formatter('time').format(ms);
}

/** 例: "2026/11/08 9:05"（ツールチップ用） */
export function formatDateTime(ms: number): string {
  return formatter('dateTime').format(ms);
}

/** time 要素の dateTime 属性に入れる文字列 */
export function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}

/** その日の 0:00 のミリ秒 */
export function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** 日付の区切り表示。today は「今日」の任意の時刻 */
export function formatDayLabel(ms: number, today: number): string {
  if (isSameDay(ms, today)) return t('today');
  const yesterday = new Date(startOfDay(today));
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(ms, yesterday.getTime())) return t('yesterday');
  return formatter('day').format(ms);
}
