import { describe, expect, it } from 'vitest';
import { activity, describeTool } from './describe.ts';

describe('describeTool', () => {
  it('Claude の組み込みツールを表示文にする', () => {
    expect(describeTool('WebSearch', { query: 'Tauri 2 sidecar' })).toBe('Web検索: Tauri 2 sidecar');
    expect(describeTool('WebFetch', { url: 'https://example.com' })).toBe('ページを読んでいます: https://example.com');
    expect(describeTool('Glob', { pattern: '**/*.md' })).toBe('ファイルを探しています…');
    expect(describeTool('Grep', { pattern: 'TODO' })).toBe('ファイルを探しています…');
    expect(describeTool('Skill', { skill: 'code-review' })).toBe('スキルを参照: code-review');
  });

  it('ファイル名は区切りが / でも \\ でも末尾だけ出す', () => {
    expect(describeTool('Read', { file_path: 'C:\\agents\\a1\\MEMORY.md' })).toBe('ファイルを読んでいます: MEMORY.md');
    expect(describeTool('Write', { file_path: '/data/agents/a1/notes.txt' })).toBe('ファイルを書いています: notes.txt');
    expect(describeTool('Edit', {})).toBe('ファイルを書いています…');
  });

  it('長い検索語と URL は省略記号で切る', () => {
    const query = 'あ'.repeat(60);
    expect(describeTool('WebSearch', { query })).toBe(`Web検索: ${'あ'.repeat(40)}…`);
    expect(describeTool('WebFetch', { url: `https://example.com/${'x'.repeat(80)}` })).toMatch(/…$/);
  });

  it('知らないツール・プロトタイプのキー名は「〜を使っています…」', () => {
    expect(describeTool('NotebookEdit', {})).toBe('NotebookEdit を使っています…');
    expect(describeTool('toString', {})).toBe('toString を使っています…');
  });

  it('入力の形が想定外でも落ちない', () => {
    expect(describeTool('WebSearch', null)).toBe('Web検索: ');
    expect(describeTool('Read', 'not an object')).toBe('ファイルを読んでいます: ');
    expect(describeTool('WebSearch', { query: 42 })).toBe('Web検索: ');
  });
});

describe('activity', () => {
  it('コマンドは 40 文字で切り、スキル名がなければ汎用の文面', () => {
    expect(activity.command('npm test')).toBe('コマンド実行: npm test');
    expect(activity.command('x'.repeat(41))).toBe(`コマンド実行: ${'x'.repeat(40)}…`);
    expect(activity.skill('')).toBe('スキルを参照しています…');
  });
});
