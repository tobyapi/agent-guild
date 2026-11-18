// システム発言の見せ方（docs/ui-design.md §5.4）。Rust の文面はそのまま出し、アイコンと名前の強調だけを決める。

export type NoticeIcon = 'join' | 'stop' | 'other';

/**
 * Rust のお知らせの決まった言い回し（contracts/behavior/notices.json の5つの言語）。
 * お知らせは作った時点の言語で保存されるので、いまの表示の言語によらず全部の言語で見分ける
 */
const JOINED_ENDINGS = [
  'がチャンネルに参加しました',
  'joined the channel.',
  '加入了频道。',
  '加入了頻道。',
  '채널에 참여했습니다.',
];
const STOPPED = ['停止しました', 'Stopped.', '已停止。', '중지했습니다.'];

/** 決まった言い回しからアイコンを選ぶ。知らない文面は菱（other） */
export function noticeIcon(content: string): NoticeIcon {
  if (JOINED_ENDINGS.some((ending) => content.endsWith(ending))) return 'join';
  if (STOPPED.includes(content)) return 'stop';
  return 'other';
}

/** 先頭が知っている名前（＋半角スペース）なら、名前と残りに分ける（名前を強調するため） */
export function splitLeadingName(content: string, names: readonly string[]): { name: string; rest: string } | null {
  const name = [...names]
    .filter((candidate) => candidate !== '')
    .sort((a, b) => b.length - a.length)
    .find((candidate) => content.startsWith(`${candidate} `));
  return name ? { name, rest: content.slice(name.length) } : null;
}
