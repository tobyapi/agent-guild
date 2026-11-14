import type { TokenizerAndRendererExtension, Tokens } from 'marked';
import { escapeHtml } from '@/shared/lib/html';
import { boundedNumber, numberList, parseOptions, pathValue, textValues } from './typographyValues';

interface TypographyToken extends Tokens.Generic {
  type: 'typographyInline';
  html: string;
}

interface LayoutToken extends Tokens.Generic {
  type: 'typographyLayout';
  lines: Tokens.Generic[][];
  vertical: boolean;
  rotate: number | null;
}

const INLINE = /^:(t|chars|path)\[([^\]\r\n]{1,120})\]\{([^}\r\n]{1,400})\}/;
let pathSequence = 0;

function attributes(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([key, value]) => ` data-typo-${key}="${escapeHtml(value)}"`)
    .join('');
}

function textHtml(text: string, source: string): string | null {
  const options = parseOptions(source, ['color', 'size', 'rotate', 'weight']);
  if (!options) return null;
  const safe = textValues(options);
  if (!safe) return null;
  return `<span class="typeText"${attributes(safe)}>${escapeHtml(text)}</span>`;
}

interface CharacterValues {
  rotate: number[];
  dx: number[];
  dy: number[];
  bend: number;
  drift: number;
}

function characterValues(source: string): CharacterValues | null {
  const options = parseOptions(source, ['rotate', 'dx', 'dy', 'bend', 'drift']);
  if (!options) return null;
  const rotate = options.rotate === undefined ? [0] : numberList(options.rotate, -360, 360);
  const dx = options.dx === undefined ? [0] : numberList(options.dx, -20, 20);
  const dy = options.dy === undefined ? [0] : numberList(options.dy, -20, 20);
  const bend = options.bend === undefined ? 0 : boundedNumber(options.bend, -360, 360);
  const drift = options.drift === undefined ? 0 : boundedNumber(options.drift, -20, 20);
  if (!rotate || !dx || !dy || bend === null || drift === null) return null;
  return { rotate, dx, dy, bend, drift };
}

function characterHtml(text: string, source: string): string | null {
  const values = characterValues(source);
  if (!values) return null;
  const at = (values: number[], index: number): number => values[Math.min(index, values.length - 1)] ?? 0;
  const spans = Array.from(text, (character, index) => {
    const angle = at(values.rotate, index) + values.bend * index;
    const x = at(values.dx, index) + values.drift * index;
    if (Math.abs(angle) > 360 || Math.abs(x) > 20) return null;
    return `<span class="typeChar"${attributes({ rotate: String(angle), dx: String(x), dy: String(at(values.dy, index)) })}>${escapeHtml(character)}</span>`;
  });
  return spans.includes(null) ? null : `<span class="typeChars">${spans.join('')}</span>`;
}

function pathHtml(text: string, source: string): string | null {
  const options = parseOptions(source, ['d', 'size']);
  if (!options || !options.d) return null;
  const path = pathValue(options.d);
  const size = options.size === undefined ? null : boundedNumber(options.size, 0.5, 5);
  if (!path || (options.size !== undefined && size === null)) return null;
  const id = `type-path-${++pathSequence}`;
  const sizeAttribute = size === null ? '' : attributes({ size: String(size) });
  return `<svg class="typePath" role="img" aria-label="${escapeHtml(text)}"${sizeAttribute}><defs><path id="${id}" data-typo-d="${escapeHtml(path)}"></path></defs><text><textPath data-typo-ref="${id}">${escapeHtml(text)}</textPath></text></svg>`;
}

export const typographyInline: TokenizerAndRendererExtension = {
  name: 'typographyInline',
  level: 'inline',
  start: (source) => source.indexOf(':'),
  tokenizer(source) {
    const match = INLINE.exec(source);
    if (!match) return undefined;
    const [, kind = '', text = '', options = ''] = match;
    const html =
      kind === 't'
        ? textHtml(text, options)
        : kind === 'chars'
          ? characterHtml(text, options)
          : pathHtml(text, options);
    if (!html) return undefined;
    const token: TypographyToken = { type: 'typographyInline', raw: match[0], html };
    return token;
  },
  renderer: (token) => (token as TypographyToken).html,
};

export const typographyLayout: TokenizerAndRendererExtension = {
  name: 'typographyLayout',
  level: 'block',
  start: (source) => source.indexOf(':::layout{'),
  tokenizer(source) {
    const match = /^:::layout\{([^}\r\n]{1,80})\}\r?\n([\s\S]*?)\r?\n:::(?:\r?\n|$)/.exec(source);
    const header = match?.[1] ?? '';
    const content = match?.[2] ?? '';
    if (!match || content.length > 4000) return undefined;
    const layout = layoutValues(header);
    if (!layout) return undefined;
    const token: LayoutToken = {
      type: 'typographyLayout',
      raw: match[0],
      ...layout,
      lines: content.split(/\r?\n/).map((line) => this.lexer.inlineTokens(line)),
    };
    return token;
  },
  renderer(token) {
    const layout = token as LayoutToken;
    const classes = `typeLayout${layout.vertical ? ' typeVertical' : ''}`;
    const rotation = layout.rotate === null ? '' : attributes({ rotate: String(layout.rotate) });
    return `<div class="${classes}"${rotation}>${layout.lines.map((line) => this.parser.parseInline(line)).join('\n')}</div>`;
  },
};

function layoutValues(header: string): Pick<LayoutToken, 'vertical' | 'rotate'> | null {
  const vertical = /^vertical(?:\s+|$)/.test(header);
  const optionSource = vertical ? header.replace(/^vertical/, '') : header;
  const options = optionSource.trim() ? parseOptions(optionSource, ['rotate']) : {};
  if (!options || (!vertical && !Object.keys(options).length)) return null;
  const rotate = options.rotate === undefined ? null : boundedNumber(options.rotate, -360, 360);
  return options.rotate !== undefined && rotate === null ? null : { vertical, rotate };
}
