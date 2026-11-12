// @vitest-environment jsdom
// 内蔵の枠の絵: 正しい SVG で、参照はすべて同じ絵の中の #id に届き、<img> の data URL として描けること。
import { describe, expect, it } from 'vitest';
import { BUILTIN_FRAMES, builtinFrame, builtinFrameSource } from './catalog';

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('内蔵の枠の絵', () => {
  it('ID は builtin: で始まり重ならない', () => {
    const ids = BUILTIN_FRAMES.map((frame) => frame.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^builtin:[a-z-]+$/);
  });

  it.each(BUILTIN_FRAMES.map((frame) => frame.id))('%s は正しい SVG で、参照が絵の中で閉じる', (id) => {
    const svg = builtinFrame(id)?.draw() ?? '';
    const doc = parse(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 128 128');
    const defined = new Set(Array.from(doc.querySelectorAll('[id]'), (element) => element.id));
    const used = Array.from(svg.matchAll(/url\(#([\w-]+)\)/g), (match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const ref of used) expect(defined.has(ref ?? ''), `#${ref}`).toBe(true);
    for (const tag of ['script', 'image', 'foreignObject', 'text', 'style']) {
      expect(doc.getElementsByTagName(tag)).toHaveLength(0);
    }
  });

  it('絵は data URL にして使い回し、知らない ID は描かない', () => {
    const source = builtinFrameSource('builtin:oak');
    expect(source?.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(builtinFrameSource('builtin:oak')).toBe(source);
    expect(builtinFrameSource('builtin:unknown')).toBeNull();
  });
});
