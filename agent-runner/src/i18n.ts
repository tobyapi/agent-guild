// ランナーが作る文字列（BackendInfo の説明・途中経過・エラー）の多言語化。プロセスで1つの「いまの言語」を持ち、
// 起動時は環境変数 GUILD_LANGUAGE、以後は setLanguage 要求で変わる。各まとまりは言語ごとの表を置き、
// createTranslator で作った t() から引く。日本語の表が正で、ほかの言語は同じキーをすべて持つ（型で検査する）。
// モデルへの指示や道具の結果は訳さない（エージェントには、選んだ言語で書くよう別に指示する）。

import type { Language } from './protocol.ts';

export const LANGUAGES: readonly Language[] = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];

/** 何も分からないときの言語（これまでの版はすべて日本語だった） */
export const DEFAULT_LANGUAGE: Language = 'ja';

export function parseLanguage(value: unknown): Language | null {
  return LANGUAGES.find((language) => language === value) ?? null;
}

let current: Language = parseLanguage(process.env.GUILD_LANGUAGE) ?? DEFAULT_LANGUAGE;

export const currentLanguage = (): Language => current;

export function setLanguage(language: Language): void {
  current = language;
}

export type Params = Readonly<Record<string, string | number>>;
/** 文字列（{name} を params で置き換える）か、数などで形が変わる文言のための関数 */
export type Message = string | ((params: Params) => string);
export type Dictionary = Readonly<Record<string, Message>>;
/** 日本語の表（正）と同じキーを、ほかの言語でもすべて持つ */
export type Messages<D extends Dictionary> = { readonly [K in keyof D]: Message };
export type Translations<D extends Dictionary> = { readonly [L in Language]: Messages<D> };

/** {name} を置き換える。値の中の {…} はそのまま残す（置き換えは文言に1回だけ） */
export function format(message: Message, params: Params = {}): string {
  if (typeof message === 'function') return message(params);
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** いまの言語の表から引く t()。呼んだ時点の言語で訳すので、訳した文字列をモジュールの定数に入れない */
export function createTranslator<D extends Dictionary>(translations: Translations<D>) {
  return function t(key: keyof D & string, params?: Params): string {
    return format(translations[current][key], params);
  };
}
