import { describe, expect, it } from 'vitest';
import { skillDeclaration } from './skillUsage';

const post = (names: string[]) => `本文\n\n\`\`\`skill-usage\n${JSON.stringify(names)}\n\`\`\``;

describe('skillDeclaration', () => {
  it('複数の申告を重複なく復元し、本文と分ける', () => {
    expect(skillDeclaration(post(['clean-code', 'plugin:review', 'clean-code']))).toEqual({
      content: '本文',
      names: ['clean-code', 'plugin:review'],
    });
  });
  it('保存・再読込後も同じ投稿の申告を復元する', () => {
    const saved = JSON.stringify({ content: post(['clean-code']) });
    const loaded = JSON.parse(saved) as { content: string };
    expect(skillDeclaration(loaded.content).names).toEqual(['clean-code']);
  });
  it('途中投稿・最終投稿・別実行の間で記録を共有しない', () => {
    expect(skillDeclaration(post(['first'])).names).toEqual(['first']);
    expect(skillDeclaration('最終返答').names).toEqual([]);
    expect(skillDeclaration(post(['other'])).names).toEqual(['other']);
  });
  it.each(['古い発言', '利用可能なスキル: clean-code', 'clean-codeスキルを使います', ''])(
    '申告がない投稿から使用実績を推測しない: %s',
    (content) => {
      expect(skillDeclaration(content)).toEqual({ content, names: [] });
    },
  );
  it.each(['null', '{}', '[1]', '["<script>"]', '["a b"]', '[""]', 'invalid'])(
    '不正な申告は本文を保持する: %s',
    (raw) => {
      const content = `本文\n\`\`\`skill-usage\n${raw}\n\`\`\``;
      expect(skillDeclaration(content)).toEqual({ content, names: [] });
    },
  );
  it('コード例や途中にあるブロックを申告として取り出さない', () => {
    for (const content of [
      `\`\`\`markdown\n${post(['example'])}`,
      `~~~~\n${post(['example'])}`,
      `\`\`\`\`\n${post(['example'])}`,
      `${post(['example'])}\n後続本文`,
    ])
      expect(skillDeclaration(content)).toEqual({ content, names: [] });
  });
  it('空配列とCRLFを扱う', () => {
    expect(skillDeclaration(post([]))).toEqual({ content: '本文', names: [] });
    expect(skillDeclaration(post(['a']).replaceAll('\n', '\r\n')).names).toEqual(['a']);
  });
  it.each([
    post(['other'])
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n'),
    `他者の出力:\n\`\`\`\`text\n${post(['other'])}\n\`\`\`\``,
    `他者の出力:\n~~~~\n${post(['other'])}\n~~~~`,
    '本文\n```skill-usage \n["other"]\n```',
    '本文\n```skill-usage\n["<skill-name>"]\n```',
    '本文\n    ```skill-usage\n    ["other"]\n    ```',
  ])('引用・コード例・形式違反を申告として取り出さない: %s', (content) => {
    expect(skillDeclaration(content)).toEqual({ content, names: [] });
  });
  it('裸の末尾フッタは出所を判定できず、当該投稿の自己申告として扱う', () => {
    expect(skillDeclaration(`他者から貼り付けた出力:\n${post(['other'])}`).names).toEqual(['other']);
  });
});
