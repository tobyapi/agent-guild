import { describe, expect, it } from 'vitest';
import { completionAction, shouldSubmit } from './keys';

const key = (overrides: Partial<Parameters<typeof shouldSubmit>[0]> = {}) => ({
  key: 'Enter',
  shiftKey: false,
  isComposing: false,
  keyCode: 13,
  ...overrides,
});

describe('shouldSubmit', () => {
  it('Enter で送信する', () => {
    expect(shouldSubmit(key())).toBe(true);
  });

  it('Shift+Enter は改行（送信しない）', () => {
    expect(shouldSubmit(key({ shiftKey: true }))).toBe(false);
  });

  it('IME 変換中の Enter は送信しない', () => {
    expect(shouldSubmit(key({ isComposing: true }))).toBe(false);
  });

  it('Safari の変換確定の Enter（isComposing が false で keyCode 229）も送信しない', () => {
    expect(shouldSubmit(key({ keyCode: 229 }))).toBe(false);
  });

  it('Enter 以外のキーでは送信しない', () => {
    expect(shouldSubmit(key({ key: 'a', keyCode: 65 }))).toBe(false);
  });
});

describe('completionAction', () => {
  it('候補の移動・決定・閉じるに対応づける', () => {
    expect(completionAction('ArrowDown')).toBe('next');
    expect(completionAction('ArrowUp')).toBe('previous');
    expect(completionAction('Enter')).toBe('pick');
    expect(completionAction('Tab')).toBe('pick');
    expect(completionAction('Escape')).toBe('close');
    expect(completionAction('a')).toBeNull();
  });
});
