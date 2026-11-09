import { describe, expect, it } from 'vitest';
import { isValidSkillName, SKILL_NAME_MAX } from './skillName';

describe('isValidSkillName', () => {
  it('英小文字・数字・ハイフンの名前を受け付ける', () => {
    expect(isValidSkillName('code-review')).toBe(true);
    expect(isValidSkillName('review2')).toBe(true);
    expect(isValidSkillName('a')).toBe(true);
  });

  it('大文字・空白・記号・日本語は受け付けない（変換もしない）', () => {
    expect(isValidSkillName('Code-Review')).toBe(false);
    expect(isValidSkillName('code review')).toBe(false);
    expect(isValidSkillName('code_review')).toBe(false);
    expect(isValidSkillName('レビュー')).toBe(false);
  });

  it('先頭・末尾・連続のハイフンと空文字は受け付けない', () => {
    expect(isValidSkillName('-review')).toBe(false);
    expect(isValidSkillName('review-')).toBe(false);
    expect(isValidSkillName('code--review')).toBe(false);
    expect(isValidSkillName('')).toBe(false);
  });

  it('64文字まで', () => {
    expect(isValidSkillName('a'.repeat(SKILL_NAME_MAX))).toBe(true);
    expect(isValidSkillName('a'.repeat(SKILL_NAME_MAX + 1))).toBe(false);
  });
});
