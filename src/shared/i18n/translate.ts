// 翻訳表から文字列を引く。文言の中の {name} を params で置き換える。
import type { Language } from '@/shared/types/domain';
import { currentLanguage } from './store';

export type Params = Readonly<Record<string, string | number>>;
/** 文字列（{name} を置き換える）か、数で形が変わる文言のための関数 */
export type Message = string | ((params: Params) => string);
export type Dictionary = Readonly<Record<string, Message>>;
/** 日本語の表（正）と同じキーを、ほかの言語でもすべて持つ */
export type Messages<D extends Dictionary> = { readonly [K in keyof D]: Message };
export type Translations<D extends Dictionary> = { readonly [L in Language]: Messages<D> };

export function format(message: Message, params: Params = {}): string {
  if (typeof message === 'function') return message(params);
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/**
 * 言語ごとの表から、いまの言語の文字列を返す関数を作る（feature ごと・部品ごとに1つ）。
 * 画面の言語を変えると App 全体が描き直されるので、描画の中で呼べば切り替わる
 */
export function createTranslator<D extends Dictionary>(translations: Translations<D>) {
  return function t(key: keyof D & string, params?: Params): string {
    return format(translations[currentLanguage()][key], params);
  };
}
