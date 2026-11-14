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
  it('部分的な赤文字・大きさ・回転・太さを保持する', () => {
    const span = body('あの :t[あのー]{color=red size=2.5 rotate=180 weight=bold}').querySelector('.typeText');
    expect(span?.textContent).toBe('あのー');
    expect(span?.getAttribute('style')).toBe('color:red;font-size:2.5em;transform:rotate(180deg);font-weight:bold');
  });

  it('文字ごとの角度と位置を保ち、足りないリスト値は最後の値を使う', () => {
    const spans = body(':chars[ぎゅう]{rotate="0 5" dx="0 0.2" dy="0"}').querySelectorAll('.typeChar');
    expect([...spans].map((span) => span.textContent)).toEqual(['ぎ', 'ゅ', 'う']);
    expect([...spans].map((span) => span.getAttribute('style'))).toEqual([
      'transform:translate(0em,0em) rotate(0deg)',
      'transform:translate(0.2em,0em) rotate(5deg)',
      'transform:translate(0.2em,0em) rotate(5deg)',
    ]);
    expect(body(':chars[ぎゅ]{bend=6 drift=0.3}').querySelectorAll('.typeChar')[1]?.getAttribute('style')).toBe(
      'transform:translate(0.3em,0em) rotate(6deg)',
    );
  });

  it('SVG の経路と文字の参照を保持する', () => {
    const host = body(':path[曲がる]{d="M0,80 C100,20 200,20 300,80" size=1.4}');
    const path = host.querySelector('path');
    const textPath = host.querySelector('textPath');
    expect(path?.getAttribute('d')).toBe('M0,80 C100,20 200,20 300,80');
    expect(textPath?.getAttribute('href')).toBe(`#${path?.id}`);
    expect(textPath?.textContent).toBe('曲がる');
    expect(host.querySelector('svg')?.getAttribute('style')).toBe('font-size:1.4em');
    expect(body(':path[閉じる]{d="M0,0 L50,50 Z"}').querySelector('path')?.getAttribute('d')).toBe('M0,0 L50,50 Z');
  });

  it('縦書きと改行・空白を保持し、中で通常の強調と部分書式を使える', () => {
    const layout = body(':::layout{vertical rotate=-8}\nあの  **声**\n　:t[あのー]{color=red}\n:::').querySelector(
      '.typeLayout',
    );
    expect(layout?.classList.contains('typeVertical')).toBe(true);
    expect(layout?.getAttribute('style')).toBe('transform:rotate(-8deg)');
    expect(layout?.innerHTML).toContain(
      'あの  <strong>声</strong>\n　<span class="typeText" style="color:red">あのー</span>',
    );
  });

  it('不正な値は書式にせず、任意の CSS とイベント属性を通さない', () => {
    for (const source of [
      ':t[危険]{color="url(javascript:alert(1))"}',
      ':t[危険]{size=999999999}',
      ':chars[危険]{rotate="0 expression(alert(1))"}',
      ':path[危険]{d="M0,0 L10,10 onerror=alert(1)"}',
    ]) {
      const host = body(source);
      expect(host.querySelector('.typeText,.typeChar,.typePath')).toBeNull();
      expect(host.textContent).toContain('危険');
    }
    const host = document.createElement('div');
    host.innerHTML = sanitizeHtml(
      '<span class="typeText" data-typo-color="red" style="background:url(javascript:evil)" onerror="evil">字</span>',
    );
    expect(host.querySelector('span')?.getAttribute('style')).toBe('color:red');
    expect(host.querySelector('span')?.hasAttribute('onerror')).toBe(false);
    expect(sanitizeHtml('<b style="color:red">字</b>')).not.toContain('style=');
  });

  it('既存のメンションの色だけは厳密な形で保持する', () => {
    const safe =
      '<span class="mention" style="--tag-fg: var(--kind-manager, var(--kind-neutral)); --tag-bg: var(--kind-manager-soft, var(--kind-neutral-soft))">@ハル</span>';
    expect(sanitizeHtml(safe)).toContain('style="--tag-fg: var(--kind-manager');
    expect(sanitizeHtml('<span class="mention" style="color:red">字</span>')).not.toContain('style=');
  });

  it('コード内と不正な配置ブロックは書式として解析しない', () => {
    expect(body('`:t[字]{color=red}`').querySelector('.typeText')).toBeNull();
    expect(body('```\n:chars[字]{bend=5}\n```').querySelector('.typeChar')).toBeNull();
    const malformed = body(':::layout{rotate=999}\n文章\n:::');
    expect(malformed.querySelector('.typeLayout')).toBeNull();
    expect(malformed.textContent).toContain(':::layout{rotate=999}');
  });

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
