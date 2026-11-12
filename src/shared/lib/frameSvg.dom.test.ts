// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { frameImageSource } from './frameSvg';

const decode = (source: string | null) =>
  decodeURIComponent((source ?? '').replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
const RING = '<circle cx="64" cy="64" r="52" fill="none" stroke="#c9a23f" stroke-width="6"></circle>';
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${body}</svg>`;

describe('frameImageSource', () => {
  it('安全な SVG は data URL にする', () => {
    const source = frameImageSource(svg(RING));
    expect(source?.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decode(source)).toContain('stroke="#c9a23f"');
  });

  it('スクリプト・イベント属性・foreignObject・外の参照を取り除く', () => {
    const dirty = svg(
      `${RING}<script>alert(1)</script><circle r="3" onload="alert(1)"></circle><foreignObject><div>x</div></foreignObject>` +
        '<path d="M0 0" style="fill:red"></path>',
    );
    const out = decode(frameImageSource(dirty));
    for (const bad of ['script', 'onload', 'foreignObject', 'style=']) expect(out).not.toContain(bad);
    expect(out).toContain('viewBox="0 0 128 128"');
    expect(out).toContain('d="M0 0"');
  });

  it('立体と質感のためのフィルタ（落ち影・ノイズ・照り）は残す', () => {
    const filter =
      '<defs><filter id="f"><feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#000"></feDropShadow>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3"></feTurbulence>' +
      '<feSpecularLighting surfaceScale="3"><feDistantLight azimuth="225" elevation="40"></feDistantLight></feSpecularLighting>' +
      '</filter></defs>';
    const out = decode(frameImageSource(svg(`${filter}${RING.replace('<circle', '<circle filter="url(#f)"')}`)));
    for (const kept of [
      'feDropShadow',
      'feTurbulence',
      'baseFrequency="0.6"',
      'feDistantLight',
      'surfaceScale="3"',
      'azimuth="225"',
      'filter="url(#f)"',
    ]) {
      expect(out).toContain(kept);
    }
  });

  it('外の url() が残るものと SVG でないものは描かない', () => {
    expect(frameImageSource(svg('<path d="M0 0" fill="url(https://example.com/x)"></path>'))).toBeNull();
    expect(frameImageSource(svg('<use href="https://example.com/a.svg#x"></use>'))).toBeNull();
    expect(frameImageSource(svg('<defs><path id="p" d="M0 0"></path></defs><use href="#p"></use>'))).not.toBeNull();
    expect(frameImageSource('<div>枠</div>')).toBeNull();
  });
});
