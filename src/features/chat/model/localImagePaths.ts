import { marked } from 'marked';

export interface LocalImagePath {
  path: string;
  alt: string;
}

const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp)$/i;
const WINDOWS_ABSOLUTE = /^[a-z]:[\\/]/i;
const UNIX_ABSOLUTE = /^\/(?!\/)/;
const HOME_PATH = /^~[\\/]/;
const RELATIVE_PATH = /^(?:\.{1,2}[\\/]|[^\\/:]+[\\/])/;
const FENCED_CODE = /^ {0,3}(`{3,}|~{3,}).*$(?:\n[\s\S]*?^ {0,3}\1[ \t]*$|[\s\S]*$)/gm;
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\((?:<([^>\n]+)>|([^\n)]+))\)/g;
const INLINE_CODE = /(`+)([^\n]*?)\1/g;
const REMOTE_OR_DATA = /(?:https?:\/\/|data:image\/)[^\s<>()]+/gi;
const PLAIN_PATH =
  /(?:~[\\/]|\/(?!\/)|[a-z]:[\\/]|(?:\.{1,2}|[^\s`<>"'()[\]{}:/\\]+)[\\/])[^\s`<>"'()[\]{}]*?\.(?:png|jpe?g|gif|webp)/gi;

function localPath(value: string): string | null {
  const path = value.trim();
  if (!IMAGE_EXTENSION.test(path) || /[\r\n\0]/.test(path)) return null;
  if (/^(?:https?|data|file):/i.test(path)) return null;
  if (!UNIX_ABSOLUTE.test(path) && !HOME_PATH.test(path) && !WINDOWS_ABSOLUTE.test(path) && !RELATIVE_PATH.test(path)) {
    return null;
  }
  return path;
}

/** Only scan visible text and image syntax. A Markdown link destination is opened on click. */
function imageSource(markdown: string): string {
  if (!markdown.includes('[')) return markdown.replace(FENCED_CODE, blank);
  const source: string[] = [];
  void marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type === 'link' || token.type === 'image') {
      if (token.type === 'image') source.push(token.raw);
      // Skip the label's descendants in this private token tree.
      token.tokens = [];
    } else if (token.type === 'codespan' || token.type === 'html' || (token.type === 'text' && !token.tokens?.length)) {
      source.push(token.raw);
    }
  });
  return source.join('\n');
}

function blank(value: string): string {
  return value.replace(/[^\n]/g, ' ');
}

/**
 * 本文に書かれたローカル画像のパスを出現順に取り出す。
 * コードブロックは対象外、インラインコードは対象。人間の発言では起点を決められない相対パスを除く。
 */
export function findLocalImagePaths(markdown: string, agentId: string | null): LocalImagePath[] {
  if (!/\.(?:png|jpe?g|gif|webp)\b/i.test(markdown)) return [];
  const source = imageSource(markdown);
  const found: LocalImagePath[] = [];
  const seen = new Set<string>();
  const add = (candidate: string, alt = '') => {
    const path = localPath(candidate);
    if (
      path === null ||
      (agentId === null && !UNIX_ABSOLUTE.test(path) && !HOME_PATH.test(path) && !WINDOWS_ABSOLUTE.test(path))
    ) {
      return;
    }
    if (seen.has(path)) return;
    seen.add(path);
    found.push({ path, alt });
  };

  let plain = source.replace(
    MARKDOWN_IMAGE,
    (raw, alt: string, anglePath: string | undefined, path: string | undefined) => {
      add(anglePath ?? path ?? '', alt);
      return blank(raw);
    },
  );
  plain = plain.replace(INLINE_CODE, (raw, _ticks: string, value: string) => {
    add(value);
    return blank(raw);
  });
  plain = plain.replace(REMOTE_OR_DATA, blank);
  for (const match of plain.matchAll(PLAIN_PATH)) add(match[0]);
  return found;
}
