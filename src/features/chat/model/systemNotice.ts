// システム発言の見せ方（docs/ui-design.md §5.4）。Rust の文面はそのまま出し、アイコンと名前の強調だけを決める。

export type NoticeIcon = 'join' | 'stop' | 'limit' | 'other';

/** 決まった言い回しからアイコンを選ぶ。知らない文面は菱（other） */
export function noticeIcon(content: string): NoticeIcon {
  if (content.endsWith('がチャンネルに参加しました')) return 'join';
  if (content === '停止しました') return 'stop';
  if (content.includes('上限に達し')) return 'limit';
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
