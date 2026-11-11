// Mermaid の図の描画。本体は大きいので、最初の図が出てくるまで読み込まない（動的 import）。
// 図のソースは AI が書いたものなので、securityLevel: 'strict'（ラベルの HTML とクリックの動作を無効にする）で描く。
import type { MermaidConfig } from 'mermaid';

export type DiagramTheme = 'dark' | 'light';

export type DiagramResult = { ok: true; svg: string } | { ok: false };

type Mermaid = (typeof import('mermaid'))['default'];

let loading: Promise<Mermaid> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let serial = 0;

export function mermaidConfig(theme: DiagramTheme): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme === 'light' ? 'default' : 'dark',
    fontFamily: 'inherit',
    suppressErrorRendering: true,
  };
}

function load(): Promise<Mermaid> {
  loading ??= import('mermaid').then((module) => module.default);
  return loading;
}

async function draw(source: string, theme: DiagramTheme): Promise<DiagramResult> {
  try {
    const mermaid = await load();
    mermaid.initialize(mermaidConfig(theme));
    if ((await mermaid.parse(source, { suppressErrors: true })) === false) return { ok: false };
    serial += 1;
    const { svg } = await mermaid.render(`guild-mermaid-${serial}`, source);
    return { ok: true, svg };
  } catch {
    return { ok: false };
  }
}

/** 図を SVG にする。文法の誤りなどで描けなければ ok: false（呼び出し側はソースを見せる）。設定が混ざらないよう1つずつ描く */
export function renderDiagram(source: string, theme: DiagramTheme): Promise<DiagramResult> {
  const result = queue.then(() => draw(source, theme));
  queue = result;
  return result;
}
