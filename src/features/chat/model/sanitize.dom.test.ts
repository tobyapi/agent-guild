// @vitest-environment jsdom
// 画面と同じく DOM のある環境で、DOMPurify の設定そのものを確かめる（DOM のない環境の振る舞いは sanitize.test.ts）。
import { describe, expect, it } from 'vitest';
import { createMarkdownRenderer } from './markdown';
import { sanitizeHtml } from './sanitize';

const markdown = createMarkdownRenderer([]);
const body = (content: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = sanitizeHtml(markdown(content));
  return host;
};

describe('sanitizeHtml（DOM のある環境）', () => {
  it('タスクリストのチェックボックスを、チェックボックスのまま残す', () => {
    const boxes = body('- [ ] やること\n- [x] 済み').querySelectorAll('input');
    expect([...boxes].map((box) => [box.type, box.checked, box.disabled])).toEqual([
      ['checkbox', false, true],
      ['checkbox', true, true],
    ]);
  });

  it('番号付きリストの始まりの番号と、表の列揃えを残す', () => {
    expect(body('3. 三番目\n4. 四番目').querySelector('ol')?.getAttribute('start')).toBe('3');
    const cells = body('| a | b |\n|:-:|--:|\n| 1 | 2 |').querySelectorAll('th');
    expect([...cells].map((cell) => cell.getAttribute('align'))).toEqual(['center', 'right']);
  });

  it('リンクは http・https の行き先と、別の窓で開く指定を残す', () => {
    const link = body('[サイト](https://example.com/a?b=1)').querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/a?b=1');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('http・https 以外の行き先、イベントの属性、読み込みを起こす要素は消す', () => {
    const host = document.createElement('div');
    host.innerHTML = sanitizeHtml(
      '<a href="javascript:alert(1)" onclick="alert(2)">a</a><a href="data:text/html,x">b</a>' +
        '<img src="https://example.com/x.png"><iframe src="https://example.com"></iframe><p>本文</p>',
    );
    expect([...host.querySelectorAll('a')].map((link) => link.getAttributeNames())).toEqual([[], []]);
    expect(host.querySelector('img, iframe')).toBeNull();
    expect(host.querySelector('p')?.textContent).toBe('本文');
  });
});
