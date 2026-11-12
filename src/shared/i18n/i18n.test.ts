import { describe, expect, it } from 'vitest';
import { detectLanguage, languageOfTag, parseLanguage } from './languages';
import { applyBootLanguage, applyLanguage, currentLanguage } from './store';
import { createTranslator, format } from './translate';

describe('言語の選び方', () => {
  it('BCP 47 のタグを選べる言語に寄せる（中国語は字体で分ける）', () => {
    expect(languageOfTag('ja-JP')).toBe('ja');
    expect(languageOfTag('en-US')).toBe('en');
    expect(languageOfTag('ko')).toBe('ko');
    expect(languageOfTag('zh-CN')).toBe('zh-Hans');
    expect(languageOfTag('zh-Hans-SG')).toBe('zh-Hans');
    expect(languageOfTag('zh-TW')).toBe('zh-Hant');
    expect(languageOfTag('zh-HK')).toBe('zh-Hant');
    expect(languageOfTag('zh-Hant')).toBe('zh-Hant');
    expect(languageOfTag('fr-FR')).toBeNull();
  });

  it('好みの並びの最初に合うもの。どれも合わなければ英語', () => {
    expect(detectLanguage(['fr-FR', 'ko-KR', 'en'])).toBe('ko');
    expect(detectLanguage(['fr-FR'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('保存した値として読めるのは5つの言語だけ', () => {
    expect(parseLanguage('zh-Hant')).toBe('zh-Hant');
    expect(parseLanguage('zh')).toBeNull();
    expect(parseLanguage(null)).toBeNull();
  });

  it('保存した言語がなければ、初回起動は OS の言語、それ以外は日本語（言語の設定がなかった版から上げた人）', () => {
    expect(applyBootLanguage('ko', true)).toBe('ko');
    expect(applyBootLanguage(null, false)).toBe('ja');
    expect(currentLanguage()).toBe('ja');
  });
});

describe('翻訳', () => {
  const t = createTranslator({
    ja: { hello: '{name}さん、こんにちは', files: '{count} 個' },
    en: { hello: 'Hello, {name}', files: ({ count }) => (count === 1 ? '1 file' : `${count} files`) },
    'zh-Hans': { hello: '你好，{name}', files: '{count} 个' },
    'zh-Hant': { hello: '你好，{name}', files: '{count} 個' },
    ko: { hello: '{name}님, 안녕하세요', files: '{count}개' },
  });

  it('いまの言語の表から引き、{name} を置き換える', () => {
    applyLanguage('ja');
    expect(t('hello', { name: '太郎' })).toBe('太郎さん、こんにちは');
    applyLanguage('en');
    expect(t('hello', { name: 'Taro' })).toBe('Hello, Taro');
    expect(t('files', { count: 2 })).toBe('2 files');
    applyLanguage('ja');
  });

  it('渡されなかった {name} はそのまま残す', () => {
    expect(format('{a} と {b}', { a: 1 })).toBe('1 と {b}');
  });
});
