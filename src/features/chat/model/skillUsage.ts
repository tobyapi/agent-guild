// 投稿末尾の明示的な使用申告。スキル一覧・通常の文章・ツール実行の推測は扱わない。
export interface SkillDeclaration {
  content: string;
  names: string[];
}

const FOOTER = /(?:^|\n)```skill-usage\r?\n([^\n]+)\r?\n```\s*$/;
const NAME = /^[\p{L}\p{N}][\p{L}\p{N}._:/-]{0,119}$/u;

export function validSkillName(name: unknown): name is string {
  return typeof name === 'string' && NAME.test(name);
}

function insideCodeFence(content: string): boolean {
  let fence = '';
  for (const line of content.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!marker) continue;
    if (!fence) fence = marker[1]!;
    else if (marker[1]![0] === fence[0] && marker[1]!.length >= fence.length && marker[2]!.trim() === '') fence = '';
  }
  return fence !== '';
}

/** 保存された投稿だけから復元する。実行や作者をまたぐ状態は持たない。 */
export function skillDeclaration(content: string): SkillDeclaration {
  const unchanged = { content, names: [] };
  const match = FOOTER.exec(content);
  if (!match || match[1]!.length > 4096) return unchanged;
  // コード例の中にあるフッターを申告として表示しない。
  const prefix = content.slice(0, match.index);
  if (insideCodeFence(prefix)) return unchanged;
  try {
    const names: unknown = JSON.parse(match[1]!);
    if (!Array.isArray(names) || names.length > 32 || !names.every(validSkillName)) return unchanged;
    return { content: prefix.trimEnd(), names: [...new Set(names)] };
  } catch {
    return unchanged;
  }
}
