import { Lexer } from 'marked';

/** CommonMark removes a backslash before punctuation. In a native drive path it is a separator. */
function driveDestination(raw: string, href: string): string {
  if (!/^[a-z]:/i.test(href) || !raw.includes('\\')) return href;
  const rules = Lexer.rules.inline.breaks;
  const destination = rules.link.exec(raw)?.[2]?.trim().replace(/^<|>$/g, '');
  return destination && /^[a-z]:\\/i.test(destination) && destination.replace(rules.anyPunctuation, '$1') === href
    ? destination
    : href;
}

/** Decode the destination once. Keep the result as data, outside the WebView's URL space. */
export function localLinkPath(href: string, rawLink: string): string | null {
  href = driveDestination(rawLink, href);
  const fileUrl = /^file:\/\/\//i.test(href);
  if (!fileUrl && !/^(?:[a-z]:[\\/]|\/)/i.test(href)) return null;
  const raw = fileUrl ? href.slice('file://'.length) : href;
  if (fileUrl && /[?#\\]/.test(raw)) return null;
  let path: string;
  try {
    path = decodeURIComponent(raw.replace(/%(?![\da-f]{2})/gi, '%25'));
  } catch {
    return null;
  }
  if (/\p{Cc}/u.test(path) || /^[\\/]{2}/.test(path)) return null;
  return fileUrl && /^\/[a-z]:\//i.test(path) ? path.slice(1) : path;
}
