// 生成したアイコンの枠の SVG を描く前に、もう一度消毒して <img> の data URL にする。
// Rust が許可リストで書き直したものだけが届くが、React でも同じものを禁じる（二重の守り）。
// <img> に入れた SVG はスクリプトを動かさず、外のものも読み込まない。
import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';

const CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'style', 'foreignObject', 'image', 'feImage', 'a', 'text', 'animate', 'set'],
  FORBID_ATTR: ['style', 'class'],
};

const LOCAL = /^#[\w.:-]+$/;

/**
 * 大文字を含む SVG の要素名。DOMPurify は HTML として読むので、構文解析器の表にない名前（feDropShadow など。
 * 環境で違う）は小文字になり、<img> の SVG（XML）では効かなくなる。消毒した後で元の綴りに戻す
 */
const CAMEL_TAGS = new Map(
  [
    'clipPath',
    'linearGradient',
    'radialGradient',
    'feGaussianBlur',
    'feOffset',
    'feFlood',
    'feComposite',
    'feMerge',
    'feMergeNode',
    'feColorMatrix',
    'feBlend',
    'feMorphology',
    'feDropShadow',
    'feTurbulence',
    'feComponentTransfer',
    'feFuncR',
    'feFuncG',
    'feFuncB',
    'feFuncA',
    'feDiffuseLighting',
    'feSpecularLighting',
    'feDistantLight',
    'fePointLight',
  ].map((name) => [name.toLowerCase(), name]),
);

function restoreTagCase(svg: string): string {
  return svg.replace(/<(\/?)([a-zA-Z]+)/g, (tag, slash: string, name: string) => {
    const camel = CAMEL_TAGS.get(name.toLowerCase());
    return camel ? `<${slash}${camel}` : tag;
  });
}
const SHAPE = /<(path|circle|ellipse|rect|line|polyline|polygon|use)[\s/>]/;

/** 消毒しても外への参照が残っていないか（href と url() は同じ文書の #id だけ） */
function onlyLocalReferences(svg: string): boolean {
  const urls = [...svg.matchAll(/url\(\s*['"]?([^'")]*)/gi)].map((match) => match[1] ?? '');
  const hrefs = [...svg.matchAll(/href="([^"]*)"/gi)].map((match) => match[1] ?? '');
  return [...urls, ...hrefs].every((target) => LOCAL.test(target.trim()));
}

/** 描ける SVG なら data URL。DOM がない・消毒で図形がなくなった・外への参照が残るなら null（枠なしで描く） */
export function frameImageSource(svg: string): string | null {
  if (!DOMPurify.isSupported) return null;
  const clean = restoreTagCase(DOMPurify.sanitize(svg, CONFIG));
  if (!clean.trimStart().startsWith('<svg') || !SHAPE.test(clean) || !onlyLocalReferences(clean)) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
}
