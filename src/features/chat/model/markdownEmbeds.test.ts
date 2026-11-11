import { describe, expect, it } from 'vitest';
import { fenceLanguage, highlightCode } from './highlight';
import { isClosedFence } from './markdownEmbeds';
import { bodyMedia, isVideoType, mediaHost } from './mediaUrl';
import { mermaidConfig } from './mermaid';

describe('isClosedFence', () => {
  it('閉じのフェンスがあれば閉じている（開きより長くてもよい。~~~ も同じ）', () => {
    expect(isClosedFence('```ts\na\n```')).toBe(true);
    expect(isClosedFence('```ts\na\n````\n')).toBe(true);
    expect(isClosedFence('~~~\na\n~~~')).toBe(true);
  });

  it('書きかけ・開きより短い閉じ・別の記号の閉じは、閉じていない', () => {
    expect(isClosedFence('```mermaid\ngraph TD')).toBe(false);
    expect(isClosedFence('```')).toBe(false);
    expect(isClosedFence('````\na\n```')).toBe(false);
    expect(isClosedFence('```\na\n~~~')).toBe(false);
  });

  it('字下げのコードブロックは閉じているものとして扱う', () => {
    expect(isClosedFence('    code')).toBe(true);
  });
});

describe('fenceLanguage / highlightCode', () => {
  it('情報行の先頭の語を小文字にして言語名にする。名前の形でなければ空', () => {
    expect(fenceLanguage('TS title="a.ts"')).toBe('ts');
    expect(fenceLanguage('c++')).toBe('c++');
    expect(fenceLanguage(undefined)).toBe('');
    expect(fenceLanguage('"><script>')).toBe('');
  });

  it('知っている言語は色分けし、知らない言語はエスケープだけする', () => {
    expect(highlightCode('let a = "<b>";', 'js')).toContain('<span class="hljs-string">&quot;&lt;b&gt;&quot;</span>');
    expect(highlightCode('<b>', 'nazo')).toBe('&lt;b&gt;');
    expect(highlightCode('<b>', '')).toBe('&lt;b&gt;');
  });
});

describe('bodyMedia', () => {
  it('https は押してから読み込む画像。パスの拡張子が動画なら動画', () => {
    expect(bodyMedia('https://example.com/a.png')).toEqual({
      kind: 'image',
      src: 'https://example.com/a.png',
      remote: true,
    });
    expect(bodyMedia('https://example.com/clip.WEBM?x=1')?.kind).toBe('video');
    expect(bodyMedia('https://example.com/?file=a.mp4')?.kind).toBe('image');
  });

  it('data: は PNG・JPEG・GIF・WebP の base64 だけをそのまま見せる', () => {
    expect(bodyMedia('data:image/png;base64,iVBORw0KGgo=')).toMatchObject({ kind: 'image', remote: false });
    expect(bodyMedia('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(bodyMedia('data:text/html;base64,PGI+')).toBeNull();
    expect(bodyMedia('data:image/png,abc')).toBeNull();
  });

  it('http・ほかのスキーム・ホストなし・空白入りは見せない', () => {
    for (const href of ['http://example.com/a.png', 'javascript:alert(1)', 'file:///c:/a.png', 'https://', 'a.png']) {
      expect(bodyMedia(href)).toBeNull();
    }
    expect(bodyMedia('https://example.com/a b.png')).toBeNull();
  });

  it('読み込み先のホストと、動画の添付の判定', () => {
    expect(mediaHost('https://img.example.com:8443/a.png')).toBe('img.example.com:8443');
    expect(mediaHost('data:image/png;base64,AA==')).toBe('');
    expect([isVideoType('video/mp4'), isVideoType('image/png')]).toEqual([true, false]);
  });
});

describe('mermaidConfig', () => {
  it('厳しい設定で描き、自動では描かず、失敗の図を画面に足さない', () => {
    expect(mermaidConfig('dark')).toMatchObject({
      securityLevel: 'strict',
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: 'dark',
    });
    expect(mermaidConfig('light').theme).toBe('default');
  });
});
