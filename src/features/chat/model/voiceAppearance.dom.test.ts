// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import catalog from '@/shared/assets/skills/character-voice/references/catalog.json';
import guide from '@/shared/assets/skills/character-voice/references/appearance.md?raw';
import { createMarkdownRenderer } from './markdown';
import { sanitizeHtml } from './sanitize';

const cards = import.meta.glob<string>('/src/shared/assets/skills/character-voice/references/modes/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const markdown = createMarkdownRenderer([]);
function render(source: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = sanitizeHtml(markdown(source));
  return host;
}
function example(title: string): string {
  const mode = catalog.modes.find((item) => item.title === title);
  if (!mode) throw new Error(`Missing style: ${title}`);
  const path = `/src/shared/assets/skills/character-voice/references/${mode.card}`;
  const section = cards[path]?.split('## 表示例（agent-guild）')[1];
  const source = /```text\r?\n([\s\S]*?)\r?\n```/.exec(section ?? '')?.[1];
  if (!source) throw new Error(`Missing display example: ${title}`);
  return source.replace(/\r\n/g, '\n');
}
const cases: [string, string, string | null][] = [
  ['走り書き', '鍵。受付に届け済み。持ち主、確認中。', null],
  ['同義反復', '無事に、何事もなく、鍵は持ち主へ戻りました。', null],
  ['隠喩の語り', '心の窓が、ようやく開いた気がします。', null],
  ['先回り案内', '受付で鍵の形を伝えれば、次に受け取り方法を確認できるでしょう。', null],
  ['指定語の順序', '指定語：星→窓星が見えたので、窓を少し開けました。', '.typeText'],
  ['中立の報告', '鍵は受付で保管されています。持ち主への連絡は完了しています。', null],
  ['否定列挙', '棚ではなく、机でもなく、受付にあります。', '.typeText'],
  ['累積反復', '鍵を。受付の鍵を。今朝、受付へ届けた鍵を。', '.typeLayout'],
  ['素朴な一人称', '私は受付に届けました。持ち主の顔は見ていません。', null],
  ['一語の執着', '鍵の持ち主に、鍵の場所を伝えました。', '.typeText'],
  ['感嘆の連打', 'あっ！見つかったんですね。よかった！', '.typeText'],
  ['つなぎ言葉', 'あの、鍵は受付に……その、あのー……', '.typeText'],
  ['問答記録', '最後に鍵を見たのは、どこでしたか。', null],
  ['舞台台詞', '私（息を整える）「お待たせしました」', '.typeLayout'],
  ['割り込む本音', '持ち主の方が（ああ、よかった）受け取ったそうです。', '.typeText'],
  ['断片的な会話', '「待って」（立ち止まる）「私も行きます」', '.typeLayout'],
  ['用語ほどき', '扉の錠を開け閉めする小さな金属片なら、受付にあります。', null],
  ['外来語まじり', 'グッドニュースです。鍵の件、オールクリアですよ。', '.typeText'],
  ['母音の引き伸ばし', '待ってますよおお。', '.typeChars'],
  ['混合方言', 'そら、見つかってよかったですねえ。', null],
  ['草木にたとえる', 'つぼみ／＼期待不安', '.typeLayout'],
  ['毒づく語り', 'この雨、しつこいったら。靴までびしょびしょだ。', '.typeText'],
  ['言いあぐねる声', 'うまく言えませんが、ほっとしたというか、胸のつかえが少し取れた気がします。', null],
  ['都会的な語り', 'なかなか気の利いた幕引きですね。鍵も持ち主のもとへ帰れたわけです。', '.typeText'],
  ['架空の田舎語り', '見つかったんだべ。そりゃ、ひと安心だなあ。', null],
  ['感情音の応答', 'えっ！ああ……ほっ。', '.typeLayout'],
  ['聞き手との関係発覚', 'そうだったんですね。あの鍵を探していたのは、あなたでしたか。', null],
];

describe('会話文体の表示例をチャットの実際のレンダラーへ通す', () => {
  it('27文体すべてを対象にする', () => {
    expect(cases.map(([title]) => title).sort()).toEqual(catalog.modes.map((mode) => mode.title).sort());
  });
  it.each(cases)('%s の言葉を落とさず表示し、無装飾の例も保持する', (id, expected, selector) => {
    const host = render(example(id));
    expect(host.textContent?.replace(/\s/g, '')).toBe(expected);
    if (selector) expect(host.querySelector(selector)).not.toBeNull();
    else expect(host.querySelector('.typeText,.typeChars,.typePath,.typeLayout')).toBeNull();
  });
  it('否定句と内心は色で区別し、反復語と外来語は太字にする', () => {
    for (const [id, words] of [
      ['否定列挙', ['ではなく', 'でもなく']],
      ['割り込む本音', ['（ああ、よかった）']],
    ] as const) {
      const nodes = [...render(example(id)).querySelectorAll('.typeText')];
      expect(nodes.map((node) => node.textContent)).toEqual(words);
      expect(nodes.every((node) => node.getAttribute('style') === 'color:red')).toBe(true);
    }
    for (const id of ['一語の執着', '外来語まじり']) {
      const nodes = [...render(example(id)).querySelectorAll('.typeText')];
      expect(nodes).toHaveLength(2);
      expect(nodes.every((node) => node.getAttribute('style') === 'font-weight:bold')).toBe(true);
    }
  });
  it('フィラーの末尾を拡大し、行と空白による間を維持する', () => {
    const filler = render(example('つなぎ言葉')).querySelector('.typeText');
    expect(filler?.textContent).toBe('あのー……');
    expect(filler?.getAttribute('style')).toContain('font-size:1.4em');
    expect(render(example('感情音の応答')).querySelector('.typeLayout')?.textContent).toBe('えっ！　ああ……\n　ほっ。');
  });
  it('共通ガイドの曲線例を読める文字とSVG参照として保持する', () => {
    const source = /:path\[[^\]]+\]\{[^}]+\}/.exec(guide)?.[0] ?? '';
    const host = render(source);
    expect(host.querySelector('svg')?.getAttribute('aria-label')).toBe('ふわり、咲く');
    expect(host.querySelector('textPath')?.textContent).toBe('ふわり、咲く');
    expect(host.querySelector('textPath')?.getAttribute('href')).toBe(`#${host.querySelector('path')?.id}`);
  });
});
