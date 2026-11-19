import { compositeColor, resolveTokenColor } from './tokenColors';
import type { ColorDefinitions, ColorSource, Rgba } from './tokenColors';

export interface SourceFile {
  file: string;
  text: string;
}
export interface TokenRow {
  name: string;
  state: string;
  accent: string;
  status: 'resolved' | 'unresolved' | 'dynamic';
  text: Rgba | null;
  overlays: Rgba[];
  background: Rgba | null;
  sources: ColorSource[];
  reason: string;
}
export interface TokenUnit {
  name: string;
  scheme: string;
  surface: Rgba;
  rows: TokenRow[];
}
export interface TokenTable {
  version: number;
  inventory: ColorSource[];
  units: TokenUnit[];
}

/** All source color/opacity declarations are retained, including unsupported and dynamic expressions. */
export function colorInventory(files: readonly SourceFile[]): ColorSource[] {
  return files.flatMap(({ file, text }) =>
    text.split('\n').flatMap((line, index) => {
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return [];
      if (!file.endsWith('.css') && !/(?:color\s*[:=]|--tag-(?:fg|bg)|--avatar-color)/.test(line)) return [];
      if (!file.endsWith('.css') && /color\??:\s*string/.test(line)) return [];
      if (!/(?:--[\w-]+|(?<![\w-])color|background(?:-color)?|opacity|fill)\s*[:=]/.test(line)) return [];
      return [{ file, line: index + 1, expression: line.trim() }];
    }),
  );
}

function definitions(files: readonly SourceFile[], scheme: string, accent: string): ColorDefinitions {
  const result: Record<string, ColorSource> = {};
  const names = ['tokens.css', 'tokens-light.css', 'tokens-accent.css', 'tokens-backdrop.css'];
  for (const name of names) {
    const source = files.find((f) => f.file.endsWith('/' + name));
    if (!source) throw new Error(`Missing ${name}`);
    for (const block of source.text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = block[1]!
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
        .split(';')
        .at(-1)!
        .trim();
      if (!selector.startsWith(':root') || selector.includes('data-background')) continue;
      if (selector.includes("data-theme='light'") && scheme !== 'light') continue;
      const selected = /data-accent='([^']+)'/.exec(selector)?.[1];
      if (selected && selected !== accent) continue;
      for (const declaration of block[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        const offset = block.index + block[0].indexOf(block[2]!) + declaration.index;
        result[declaration[1]!] = {
          file: source.file,
          line: source.text.slice(0, offset).split('\n').length,
          expression: declaration[2]!.trim(),
        };
      }
    }
  }
  return result;
}

const accents = ['default', 'vermilion', 'sakura', 'green', 'sky', 'violet', 'silver'];
const panes = ['sidebar', 'chat', 'members'];
const normalTokens =
  /^--(?:text-(?:primary|secondary|muted|link)|accent-text|danger|warning|success|kind-(?!.*-soft$)[\w-]+|mention-text|syntax-[\w-]+|autonomous)$/;

export function buildTokenTable(files: readonly SourceFile[]): TokenTable {
  const inventory = colorInventory(files);
  const pending = inventory.filter(
    (s) => !s.file.includes('/theme/tokens') && /(?:\bcolor\s*[:=]|opacity\s*:|--tag-(?:fg|bg))/.test(s.expression),
  );
  const units = ['dark', 'light'].flatMap((scheme) =>
    panes.map((pane) => {
      const base = definitions(files, scheme, 'default');
      const surface = resolveTokenColor(`var(--surface-${pane})`, base);
      if (!surface || surface.alpha !== 1) throw new Error(`Unresolved surface ${pane}`);
      const rows = accents.flatMap((accent) => accentRows(definitions(files, scheme, accent), pane, accent, surface));
      return { name: `${pane}-${scheme}`, scheme, surface, rows: [...rows, ...pending.map(pendingRow)] };
    }),
  );
  return { version: 1, inventory, units };
}

function resolvedRow(
  defs: ColorDefinitions,
  pane: string,
  accent: string,
  surface: Rgba,
  token: string,
  state: string,
  backgrounds: string[],
): TokenRow {
  const text = resolveTokenColor(`var(${token})`, defs);
  const overlays = backgrounds.map((name) => resolveTokenColor(`var(${name})`, defs));
  const resolved = !!text && overlays.every((c) => c !== null);
  const colors = overlays.filter((c): c is Rgba => c !== null);
  return {
    name: token,
    state,
    accent,
    status: resolved ? 'resolved' : 'unresolved',
    text,
    overlays: colors,
    background: resolved ? colors.reduce((bg, color) => compositeColor(color, bg), surface) : null,
    sources: [token, ...backgrounds, `--surface-${pane}`].map((name) => defs[name]!).filter(Boolean),
    reason: 'Static conservative token/state coverage; element cascade is separately pending.',
  };
}

function accentRows(defs: ColorDefinitions, pane: string, accent: string, surface: Rgba): TokenRow[] {
  const rows: TokenRow[] = [];
  const add = (token: string, state: string, backgrounds: string[]) =>
    rows.push(resolvedRow(defs, pane, accent, surface, token, state, backgrounds));
  for (const token of Object.keys(defs).filter((name) => normalTokens.test(name))) {
    if (
      accent !== 'default' &&
      !['--accent-text', '--text-primary', '--text-secondary', '--text-muted'].includes(token)
    )
      continue;
    for (const [state, background] of [
      ['normal', ''],
      ['hover', '--bg-hover'],
      ['selected', '--bg-active'],
      ['accent-soft', '--accent-soft'],
      ...(pane === 'chat' ? [['mention-self-bg', '--mention-self-bg']] : []),
    ]) {
      if (accent === 'default' || token === '--accent-text' || state === 'accent-soft')
        add(token, state!, background ? [background] : []);
    }
  }
  for (const bg of ['--accent', '--accent-hover']) add('--text-on-accent', bg, [bg]);
  if (accent === 'default') addSpecialRows(defs, add);

  return rows;
}

function addSpecialRows(
  defs: ColorDefinitions,
  add: (token: string, state: string, backgrounds: string[]) => unknown,
): void {
  for (const token of ['--text-primary', '--text-muted']) add(token, 'bg-input', ['--bg-input']);
  for (const token of Object.keys(defs).filter((name) => name.startsWith('--syntax-')))
    add(token, 'code', ['--bg-sunken']);
  for (const token of [
    '--danger',
    '--warning',
    '--success',
    '--autonomous',
    '--kind-human',
    '--kind-worker',
    '--kind-ideator',
    '--kind-manager',
    '--kind-expert',
  ])
    add(token, 'semantic-soft', [`${token}-soft`]);
  for (const bg of ['--danger', '--danger-hover']) add('--text-on-danger', bg, [bg]);
}

function pendingRow(source: ColorSource): TokenRow {
  const dynamic = /--tag-|\$\{|\.color|color[=:]\s*\{/.test(source.expression);
  return {
    name: source.file + ':' + source.line,
    state: 'source-cascade',
    accent: 'all',
    status: dynamic ? 'dynamic' : 'unresolved',
    text: null,
    overlays: [],
    background: null,
    sources: [source],
    reason: dynamic
      ? 'User/tag/inline color is dynamic and unguaranteed.'
      : 'Inherited foreground/background, ancestor opacity and selector applicability require cascade verification.',
  };
}

/** Select the requested unit without I/O or changing the contract table. */
export function readTokenUnit(table: TokenTable, name: string): TokenUnit {
  const unit = table.units.find((candidate) => candidate.name === name);
  if (!unit) throw new Error(`Unknown token unit ${name}`);
  return unit;
}
