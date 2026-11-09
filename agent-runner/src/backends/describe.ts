// 途中経過の表示文（UI の「〜中…」）。各アダプタは自分の SDK のイベントをここの文面に写す。

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}…` : text);

/** 区切りが / でも \ でも末尾の名前を返す（実行環境の OS に依らない） */
const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

export const activity = {
  thinking: (): string => '考え中…',
  writing: (): string => '書いています…',
  webSearch: (query: string): string => `Web検索: ${clip(query, 40)}`,
  webFetch: (url: string): string => `ページを読んでいます: ${clip(url, 50)}`,
  readFile: (path: string): string => `ファイルを読んでいます: ${baseName(path)}`,
  writeFile: (path: string | undefined): string =>
    path ? `ファイルを書いています: ${baseName(path)}` : 'ファイルを書いています…',
  searchFiles: (): string => 'ファイルを探しています…',
  skill: (name: string): string => (name ? `スキルを参照: ${name}` : 'スキルを参照しています…'),
  command: (command: string): string => `コマンド実行: ${clip(command, 40)}`,
  posting: (): string => 'チャットに投稿しています…',
  tool: (name: string): string => `${name} を使っています…`,
};

type Field = (key: string) => string;

/** Claude Agent SDK の組み込みツール名 → 表示文 */
const CLAUDE_TOOLS: Readonly<Record<string, (field: Field) => string>> = {
  WebSearch: (field) => activity.webSearch(field('query')),
  WebFetch: (field) => activity.webFetch(field('url')),
  Read: (field) => activity.readFile(field('file_path')),
  Write: (field) => activity.writeFile(field('file_path')),
  Edit: (field) => activity.writeFile(field('file_path')),
  Glob: () => activity.searchFiles(),
  Grep: () => activity.searchFiles(),
  Skill: (field) => activity.skill(field('skill') || field('name')),
  Bash: (field) => activity.command(field('command')),
};

/** ツール呼び出し（名前と入力）を表示文にする。入力の形は信用せず、文字列のフィールドだけ使う */
export function describeTool(name: string, input: unknown): string {
  const field: Field = (key) => {
    const value = typeof input === 'object' && input !== null ? (input as Record<string, unknown>)[key] : undefined;
    return typeof value === 'string' ? value : '';
  };
  const describe = Object.hasOwn(CLAUDE_TOOLS, name) ? CLAUDE_TOOLS[name] : undefined;
  return describe ? describe(field) : activity.tool(name);
}
