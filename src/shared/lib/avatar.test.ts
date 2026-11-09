import { describe, expect, it } from 'vitest';
import { avatarFallback, isImageAvatar } from './avatar';

describe('isImageAvatar', () => {
  it('ラスター画像の data URL だけを画像とみなす', () => {
    expect(isImageAvatar('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isImageAvatar('data:image/webp;base64,UklGRg==')).toBe(true);
    expect(isImageAvatar('🌱')).toBe(false);
    expect(isImageAvatar('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isImageAvatar('https://example.com/a.png')).toBe(false);
  });
});

describe('avatarFallback', () => {
  it('名前の最初の1文字（サロゲートペアも1文字）を返す', () => {
    expect(avatarFallback(' ハル')).toBe('ハ');
    expect(avatarFallback('𠮷田')).toBe('𠮷');
    expect(avatarFallback('')).toBe('?');
  });
});
