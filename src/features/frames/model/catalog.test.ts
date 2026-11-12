import { describe, expect, it } from 'vitest';
import { BUILTIN_FRAMES } from '@/shared/ui';
import { builtinFrameName, frameChoices, resolveFrame } from './catalog';

const custom = [
  { id: 'custom:1', name: '月夜の薔薇', createdAt: 1, kind: 'svg', src: 'data:image/svg+xml,x', loading: false },
  { id: 'custom:2', name: '描けない枠', createdAt: 2, kind: 'svg', src: null, loading: false },
  { id: 'custom:3', name: '灯火の蛾', createdAt: 3, kind: 'png', src: 'data:image/png;base64,x', loading: false },
  { id: 'custom:4', name: '取得中の枠', createdAt: 4, kind: 'png', src: null, loading: true },
] as const;

describe('枠の選択肢', () => {
  it('「なし」→ 内蔵の枠 → 生成の枠の順（描けない SVG の枠は出さず、画像の枠は絵を取っている間も出す）', () => {
    const choices = frameChoices(custom);
    expect(choices.map((choice) => choice.id)).toEqual([
      '',
      ...BUILTIN_FRAMES.map((f) => f.id),
      'custom:1',
      'custom:3',
      'custom:4',
    ]);
    expect(choices[0]).toMatchObject({ name: 'なし', frame: null, removable: false, loading: false });
    expect(choices.at(-2)).toMatchObject({ frame: { kind: 'custom', src: 'data:image/png;base64,x' }, loading: false });
    expect(choices.at(-1)).toMatchObject({ frame: null, removable: true, loading: true });
  });

  it('内蔵の枠はすべて名前を持つ', () => {
    for (const frame of BUILTIN_FRAMES) expect(builtinFrameName(frame.id)).not.toBe(frame.id);
  });

  it('保存した ID から描く枠を決める（知らない・消えた・描けない枠は枠なし）', () => {
    expect(resolveFrame('', custom)).toBeNull();
    expect(resolveFrame('builtin:moth', custom)).toEqual({ kind: 'builtin', id: 'builtin:moth' });
    // 以前の試作の ID（いまは内蔵にない）も、知らない枠として枠なしで描く
    expect(resolveFrame('builtin:rose', custom)).toBeNull();
    expect(resolveFrame('builtin:unknown', custom)).toBeNull();
    expect(resolveFrame('custom:1', custom)).toEqual({ kind: 'custom', src: 'data:image/svg+xml,x' });
    expect(resolveFrame('custom:2', custom)).toBeNull();
    expect(resolveFrame('custom:3', custom)).toEqual({ kind: 'custom', src: 'data:image/png;base64,x' });
    expect(resolveFrame('custom:4', custom)).toBeNull();
    expect(resolveFrame('custom:9', custom)).toBeNull();
  });
});
