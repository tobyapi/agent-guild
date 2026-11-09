// フォルダのパスの比較（表示と事前の確認用。正はサーバの検証）。

/** 末尾の区切りを除き、Windows のパス（ドライブ文字・UNC）は大文字小文字を無視してそろえる */
function normalizePath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, '');
  return /^(?:[a-z]:|\\\\)/i.test(trimmed) ? trimmed.replace(/\//g, '\\').toLowerCase() : trimmed;
}

export function isSamePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

/** child が parent の中（同じフォルダは含まない）にあるか */
export function isInsidePath(child: string, parent: string): boolean {
  const base = normalizePath(parent);
  const target = normalizePath(child);
  const separator = /^(?:[a-z]:|\\\\)/i.test(base) ? '\\' : '/';
  return target.startsWith(`${base}${separator}`);
}

/** 末尾のフォルダ名（表示用） */
export function folderName(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, '');
  return trimmed.slice(Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/')) + 1) || trimmed;
}
