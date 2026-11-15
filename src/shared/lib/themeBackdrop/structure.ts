import { array, choice, number, object, reject, text } from './checks';

const ROOT_KEYS = ['schemaVersion', 'catalogVersion', 'title', 'seed', 'palette', 'composition', 'layers'];
const LAYER_KEYS = ['kind', 'motif', 'anchor', 'color', 'scale', 'density', 'depth', 'motion'];
const MOTIFS: Readonly<Record<string, readonly string[]>> = {
  tile: ['star', 'cross', 'dot', 'wave', 'seaweed', 'tree', 'turtle'],
  symbol: ['star', 'cross', 'dot', 'wave', 'seaweed', 'tree', 'turtle'],
  halftone: ['hill', 'cloud', 'wave'],
  paper: ['hill', 'cloud', 'wave', 'seaweed', 'tree', 'turtle', 'aurora'],
};

// Raw JSON must pass parseRecipeJson first. This gate does not authorize rendering or saving.
export function validateRecipeStructure(value: unknown): void {
  const root = object(value, '$', ROOT_KEYS);
  version(root.schemaVersion, 'schemaVersion', 'unsupported_version');
  version(root.catalogVersion, 'catalogVersion', 'unsupported_catalog');
  const title = text(root.title, 'title');
  if (Array.from(title).length < 1 || Array.from(title).length > 40 || new TextEncoder().encode(title).length > 160) {
    reject('title', 'invalid_title');
  }
  if (/[\p{Cc}\u2028\u2029]/u.test(title)) reject('title', 'invalid_title');
  number(root.seed, 'seed', 0, 4294967295, true);
  const paletteLength = palette(root.palette);
  choice(root.composition, 'composition', ['quietCenter'], 'unsupported_composition');
  const layers = array(root.layers, 'layers');
  if (!layers.length) reject('layers', 'too_few_layers');
  if (layers.length > 8) reject('layers', 'too_many_layers');
  const checked = layers.map((layer, index) => layerStructure(layer, index, paletteLength));
  checked.forEach(catalog);
}

function version(value: unknown, field: string, code: string): void {
  number(value, field, -Infinity, Infinity, true);
  if (value !== 1) reject(field, code);
}

function palette(value: unknown): number {
  const colors = object(value, 'palette', ['dark', 'light']);
  for (const scheme of ['dark', 'light']) {
    const field = `palette.${scheme}`;
    const entries = array(colors[scheme], field);
    if (entries.length < 4 || entries.length > 8) reject(field, 'invalid_palette_length');
    entries.forEach((color, index) => {
      const path = `${field}[${index}]`;
      if (!/^#[\da-fA-F]{6}$/.test(text(color, path))) reject(path, 'invalid_color');
    });
  }
  const dark = array(colors.dark, 'palette.dark');
  if (dark.length !== array(colors.light, 'palette.light').length) reject('palette', 'palette_length_mismatch');
  return dark.length;
}

function layerStructure(value: unknown, index: number, paletteLength: number): Record<string, unknown> {
  const field = `layers[${index}]`;
  const layer = object(value, field, LAYER_KEYS);
  choice(layer.kind, `${field}.kind`, Object.keys(MOTIFS), 'unsupported_kind');
  text(layer.motif, `${field}.motif`);
  choice(layer.anchor, `${field}.anchor`, ['left', 'right', 'bottomLeft', 'bottomRight'], 'unsupported_anchor');
  const color = number(layer.color, `${field}.color`, 1, 7, true);
  if (color >= paletteLength) reject(`${field}.color`, 'color_out_of_bounds');
  number(layer.scale, `${field}.scale`, 0.25, 1);
  number(layer.density, `${field}.density`, 0, 1);
  number(layer.depth, `${field}.depth`, 1, 3, true);
  choice(layer.motion, `${field}.motion`, ['none', 'drift', 'sway'], 'unsupported_motion');
  return layer;
}

function catalog(layer: Record<string, unknown>, index: number): void {
  const field = `layers[${index}]`;
  const kind = text(layer.kind, `${field}.kind`);
  const motif = text(layer.motif, `${field}.motif`);
  if (!MOTIFS[kind].includes(motif)) reject(`${field}.motif`, 'unsupported_motif');
  if (kind !== 'paper' && layer.depth !== 1) reject(`${field}.depth`, 'invalid_depth');
  if (kind === 'paper' && layer.density !== 0.5) reject(`${field}.density`, 'invalid_density');
  if (!allowedMotion(kind, motif, layer.motion)) reject(`${field}.motion`, 'unsupported_motion');
}

function allowedMotion(kind: string, motif: string, motion: unknown): boolean {
  if (motion === 'none') return true;
  if (motion === 'drift') return kind === 'paper' && ['cloud', 'wave', 'turtle', 'aurora'].includes(motif);
  return motion === 'sway' && ['paper', 'symbol'].includes(kind) && ['tree', 'seaweed'].includes(motif);
}
