import { describe, expect, it } from 'vitest';
import { frameDescriptionProblem, frameName, isCustomFrameId, isFrameIdShape } from './frames';

describe('アイコンの枠の規則', () => {
  it('ID は空・builtin:・custom: だけ', () => {
    for (const ok of ['', 'builtin:rose', ' custom:1b2c-3d ']) expect(isFrameIdShape(ok)).toBe(true);
    for (const bad of ['rose', 'builtin:', 'custom:../x', 'other:rose']) expect(isFrameIdShape(bad)).toBe(false);
    expect(isCustomFrameId('custom:1')).toBe(true);
    expect(isCustomFrameId('builtin:rose')).toBe(false);
  });

  it('説明は必須で200文字まで', () => {
    expect(frameDescriptionProblem('  ')).toBe('empty');
    expect(frameDescriptionProblem('あ'.repeat(201))).toBe('tooLong');
    expect(frameDescriptionProblem('月夜の薔薇と鎖')).toBeNull();
  });

  it('名前がなければ説明の1行目を24文字まで使う（Rust と同じ）', () => {
    expect(frameName(' 夜の鎖 ', 'x')).toBe('夜の鎖');
    expect(frameName('', '月夜の薔薇と鎖\n二行目')).toBe('月夜の薔薇と鎖');
    expect(Array.from(frameName('', '長'.repeat(40)))).toHaveLength(24);
  });
});
