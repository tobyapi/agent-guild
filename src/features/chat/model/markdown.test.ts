import { describe, expect, it } from 'vitest';
import { createMarkdownRenderer } from './markdown';

const render = createMarkdownRenderer([
  { id: 'hal', name: 'ハル', kind: 'agent', accent: 'manager' },
  { id: 'haruka', name: 'ハルカ', kind: 'agent', accent: null },
  { id: 'bob', name: 'Bob', kind: 'agent', accent: 'worker' },
  { id: 'me', name: 'ユーザー', kind: 'human', accent: 'human' },
  { id: 'old', name: 'ソラ', kind: 'deleted', accent: null },
]);

describe('createMarkdownRenderer: Markdown', () => {
  it('強調・箇条書きを HTML にし、1行の改行も <br> にする', () => {
    const html = render('**大事**\n- a\n- b');
    expect(html).toContain('<strong>大事</strong>');
    expect(html).toContain('<li>a</li>');
    expect(render('1行目\n2行目')).toContain('<br>');
  });
});

describe('createMarkdownRenderer: メンション', () => {
  it('知っている名前を、accent の CSS 変数を組み立てた色つきのチップにする（値で分岐しない）', () => {
    expect(render('@ハル お願い')).toContain(
      '<span class="mention" data-kind="agent" data-mention-id="hal" style="--tag-fg: var(--kind-manager, var(--kind-neutral)); --tag-bg: var(--kind-manager-soft, var(--kind-neutral-soft))">@ハル</span>',
    );
    expect(render('@ユーザー')).toContain('data-kind="human" data-mention-id="me" style="--tag-fg: var(--kind-human, var(--kind-neutral));');
  });

  it('色の決まらない相手は style を付けず、既定のチップの色にする', () => {
    expect(render('@ハルカ')).toContain('<span class="mention" data-kind="agent" data-mention-id="haruka">@ハルカ</span>');
  });

  it('長い名前を優先し、全角の＠と大文字小文字の違いも認識する', () => {
    expect(render('＠ハルカ さん')).toContain('data-mention-id="haruka">@ハルカ</span>');
    expect(render('@bob へ')).toContain('data-mention-id="bob"');
    expect(render('@bob へ')).toContain('>@Bob</span>');
  });

  it('削除済みの相手は既定のチップにして、ツールチップで知らせる', () => {
    expect(render('@ソラ')).toContain('data-kind="deleted" data-mention-id="old" title="削除済みのエージェント"');
  });

  it('知らない名前とコードの中はチップにしない', () => {
    expect(render('@だれか')).not.toContain('mention');
    expect(render('`@ハル`')).not.toContain('class="mention"');
    expect(render('```\n@ハル\n```')).not.toContain('class="mention"');
  });
});

describe('createMarkdownRenderer: 安全性', () => {
  it('生の HTML はタグとして解釈せず文字にする', () => {
    const html = render('<script>alert(1)</script><b onclick="x()">b</b>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b ');
    expect(html).toContain('&lt;script&gt;');
  });

  it('http(s) のリンクは別ウィンドウで開くリンクにし、javascript: などは文字だけにする', () => {
    expect(render('[サイト](https://example.com/?a=1&b=2)')).toContain(
      '<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">サイト</a>',
    );
    const unsafe = render('[押して](javascript:alert(1))');
    expect(unsafe).not.toContain('<a');
    expect(unsafe).toContain('押して');
    expect(render('[メール](mailto:a@example.com)')).not.toContain('<a');
  });

  it('画像は読み込まずにリンクにする', () => {
    const html = render('![図](https://example.com/a.png)');
    expect(html).not.toContain('<img');
    expect(html).toContain('画像: 図');
  });
});
