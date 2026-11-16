import { describe, expect, it } from 'vitest';
import { findLocalImagePaths } from './localImagePaths';

const paths = (content: string, agentId: string | null = 'agent-1') =>
  findLocalImagePaths(content, agentId).map((image) => image.path);

describe('findLocalImagePaths', () => {
  it('Markdown の画像と、本文の Unix・ホーム・Windows・相対パスを見つける', () => {
    const content = [
      '![完成図](/Users/me/result.png)',
      '~/Pictures/a.JPG',
      String.raw`C:\Users\me\b.jpeg`,
      'D:/work/c.GIF',
      'work/output/d.WeBp',
    ].join('\n');
    expect(findLocalImagePaths(content, 'agent-1')).toEqual([
      { path: '/Users/me/result.png', alt: '完成図' },
      { path: '~/Pictures/a.JPG', alt: '' },
      { path: String.raw`C:\Users\me\b.jpeg`, alt: '' },
      { path: 'D:/work/c.GIF', alt: '' },
      { path: 'work/output/d.WeBp', alt: '' },
    ]);
  });

  it('インラインコードは対象にし、フェンス付きコードブロックは対象外にする', () => {
    expect(paths('`work/a.png`\n```text\nwork/hidden.png\n```\nafter/b.webp')).toEqual(['work/a.png', 'after/b.webp']);
  });

  it('人間の相対パスは除き、絶対パスは残す', () => {
    expect(paths('work/a.png /Users/me/b.png C:/Users/me/c.png ~/d.gif', null)).toEqual([
      '/Users/me/b.png',
      'C:/Users/me/c.png',
      '~/d.gif',
    ]);
  });

  it('対象外の拡張子、単独ファイル名、https・data URL は拾わない', () => {
    expect(paths('a.png work/a.svg https://example.com/a.png data:image/png;base64,abc work/a.png')).toEqual([
      'work/a.png',
    ]);
  });

  it('同じパスは一度だけ返す', () => {
    expect(paths('![a](work/a.png) and `work/a.png` and work/a.png')).toEqual(['work/a.png']);
  });
});
