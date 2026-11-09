// 日時の表示。すべてローカル時刻で扱う。

const timeFormat = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
const dayFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

/** 例: "09:05" */
export function formatTime(ms: number): string {
  return timeFormat.format(ms);
}

/** 例: "2026/11/08 9:05"（ツールチップ用） */
export function formatDateTime(ms: number): string {
  return dateTimeFormat.format(ms);
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
  if (isSameDay(ms, today)) return '今日';
  const yesterday = new Date(startOfDay(today));
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(ms, yesterday.getTime())) return '昨日';
  return dayFormat.format(ms);
}
