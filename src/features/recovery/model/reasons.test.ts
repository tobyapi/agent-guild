import { describe, expect, it } from 'vitest';
import { orderedActions, reasonCopy, recommendedAction } from './reasons';

describe('reasonCopy', () => {
  it('理由ごとの見出しを返す', () => {
    expect(reasonCopy('missing').title).toBe('データフォルダが見つかりません');
    expect(reasonCopy('locked').title).toBe('AIギルドがすでに起動しています');
    expect(reasonCopy('none').title).toBe('データフォルダを開けませんでした');
  });
});

describe('recommendedAction / orderedActions', () => {
  it('理由に合わせておすすめを選ぶ', () => {
    expect(recommendedAction('missing', false)).toBe('retry');
    expect(recommendedAction('foreign', false)).toBe('choose');
    expect(recommendedAction('corrupt', false)).toBe('useDefault');
  });

  it('いまの場所が既定なら「既定の場所に戻す」の代わりに「別のフォルダを選ぶ」をすすめる', () => {
    expect(recommendedAction('corrupt', true)).toBe('choose');
  });

  it('おすすめを先頭に並べる', () => {
    expect(orderedActions('choose')).toEqual(['choose', 'retry', 'useDefault']);
  });
});
