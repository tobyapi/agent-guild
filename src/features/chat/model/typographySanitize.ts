import DOMPurify from 'dompurify';
import { accentStyleText } from '@/shared/lib/accent';
import { boundedNumber, pathValue, textValues } from './typographyValues';

function data(node: Element, name: string): string | null {
  const value = node.getAttribute(`data-typo-${name}`);
  node.removeAttribute(`data-typo-${name}`);
  return value;
}

function numeric(node: Element, name: string, min: number, max: number): number | null {
  return boundedNumber(data(node, name) ?? undefined, min, max);
}

function textStyle(node: Element): string | null {
  const options = Object.fromEntries(
    ['color', 'size', 'rotate', 'weight'].flatMap((key) => {
      const value = data(node, key);
      return value === null ? [] : [[key, value]];
    }),
  );
  const safe = textValues(options);
  if (!safe) return null;
  const styles = [
    safe.color && `color:${safe.color}`,
    safe.size && `font-size:${safe.size}em`,
    safe.rotate && `transform:rotate(${safe.rotate}deg)`,
    safe.weight && `font-weight:${safe.weight}`,
  ].filter(Boolean);
  return styles.length ? styles.join(';') : null;
}

function characterStyle(node: Element): string | null {
  const rotate = numeric(node, 'rotate', -360, 360);
  const dx = numeric(node, 'dx', -20, 20);
  const dy = numeric(node, 'dy', -20, 20);
  if (rotate === null || dx === null || dy === null) return null;
  return `transform:translate(${dx}em,${dy}em) rotate(${rotate}deg)`;
}

function styleFor(node: Element, tag: string): string | null {
  if (tag === 'span' && node.classList.contains('typeText')) return textStyle(node);
  if (tag === 'span' && node.classList.contains('typeChar')) return characterStyle(node);
  if (tag === 'div' && node.classList.contains('typeLayout')) {
    const rotate = numeric(node, 'rotate', -360, 360);
    return rotate === null ? null : `transform:rotate(${rotate}deg)`;
  }
  if (tag === 'svg' && node.classList.contains('typePath')) {
    const size = numeric(node, 'size', 0.5, 5);
    return size === null ? null : `font-size:${size}em`;
  }
  return null;
}

function sanitizeSvgAttributes(node: Element, tag: string): void {
  if (tag === 'path' && /^type-path-\d+$/.test(node.getAttribute('id') ?? '')) {
    const path = pathValue(data(node, 'd') ?? undefined);
    node.removeAttribute('d');
    if (path) node.setAttribute('d', path);
  }
  if (tag === 'textpath') {
    const ref = data(node, 'ref');
    node.removeAttribute('href');
    if (ref && /^type-path-\d+$/.test(ref)) node.setAttribute('href', `#${ref}`);
  }
}

function mentionStyle(node: Element): string | null {
  if (node.tagName.toLowerCase() !== 'span' || !node.classList.contains('mention')) return null;
  const style = node.getAttribute('style') ?? '';
  const accent = /^--tag-fg: var\(--kind-([a-z0-9-]+), var\(--kind-neutral\)\);/.exec(style)?.[1];
  return accent && accentStyleText(accent) === style ? style : null;
}

/** DOMPurify が属性を除去した後に、検証済みの数値からだけ style を組み立てる。 */
export function installTypographySanitizer(): void {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const chipStyle = mentionStyle(node);
    node.removeAttribute('style');
    const style = styleFor(node, tag) ?? chipStyle;
    if (tag === 'svg' && node.classList.contains('typePath')) node.setAttribute('viewBox', '0 0 600 120');
    sanitizeSvgAttributes(node, tag);
    if (style) node.setAttribute('style', style);
  });
}
