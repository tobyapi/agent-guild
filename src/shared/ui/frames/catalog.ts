// 内蔵のアイコンの枠の一覧（ID・絵）。名前は使う画面（features/frames）の翻訳表が持つ。
// 並びは選ぶ画面の順。ID は保存されるので変えない（消すと、その枠を選んでいたメンバーは枠なしで描かれる）。
import { astrolabeFrame } from './art/astrolabe';
import { clockworkFrame } from './art/clockwork';
import { harborFrame } from './art/harbor';
import { masqueradeFrame } from './art/masquerade';
import { mothFrame } from './art/moth';
import { oakFrame } from './art/oak';
import { ravenFrame } from './art/raven';
import { teatimeFrame } from './art/teatime';

export interface BuiltinFrame {
  /** `builtin:<名前>` */
  id: string;
  /** 枠の SVG 文書（viewBox 0 0 128 128。中央の角丸の正方形にアバターが入る） */
  draw: () => string;
}

export const BUILTIN_FRAMES: readonly BuiltinFrame[] = [
  { id: 'builtin:oak', draw: oakFrame },
  { id: 'builtin:harbor', draw: harborFrame },
  { id: 'builtin:clockwork', draw: clockworkFrame },
  { id: 'builtin:teatime', draw: teatimeFrame },
  { id: 'builtin:moth', draw: mothFrame },
  { id: 'builtin:raven', draw: ravenFrame },
  { id: 'builtin:masquerade', draw: masqueradeFrame },
  { id: 'builtin:astrolabe', draw: astrolabeFrame },
];

export function builtinFrame(id: string): BuiltinFrame | undefined {
  return BUILTIN_FRAMES.find((frame) => frame.id === id);
}

const sources = new Map<string, string>();

/** 内蔵の枠の絵の data URL（一度だけ組み立てて使い回す。<img> は同じ URL の絵を大きさごとに一度だけ描く） */
export function builtinFrameSource(id: string): string | null {
  const cached = sources.get(id);
  if (cached) return cached;
  const frame = builtinFrame(id);
  if (!frame) return null;
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frame.draw())}`;
  sources.set(id, source);
  return source;
}

/** 描く枠: 内蔵の枠（ID）か、生成した枠（消毒済みの SVG の data URL） */
export type ResolvedFrame = { kind: 'builtin'; id: string } | { kind: 'custom'; src: string };
