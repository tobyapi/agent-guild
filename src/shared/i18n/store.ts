// いまの表示の言語。最初の描画の前に localStorage から読み（起動中の画面も前回の言語で出す）、
// 起動の結果（BootStatus.language）と設定の変更で切り替える。<html lang> も合わせる。
import { create } from 'zustand';
import type { Language } from '@/shared/types/domain';
import { DEFAULT_LANGUAGE, detectLanguage, parseLanguage } from './languages';

export const LANGUAGE_STORAGE_KEY = 'agent-guild.language';

function readStored(): Language | null {
  try {
    return typeof localStorage === 'undefined' ? null : parseLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function systemLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : navigator.languages;
}

const useLanguageStore = create<{ language: Language }>()(() => ({ language: readStored() ?? DEFAULT_LANGUAGE }));

function applyDocument(language: Language): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

/** 描画の外（モデルの関数など）からいまの言語を知る */
export function currentLanguage(): Language {
  return useLanguageStore.getState().language;
}

/** 言語が変わったら描き直したい部品が使う（App の根が使っているので、ふつうは要らない） */
export function useLanguage(): Language {
  return useLanguageStore((state) => state.language);
}

/** 表示の言語を変えて、この端末に覚えておく（settings.json への保存は settings feature が別に行う） */
export function applyLanguage(language: Language): void {
  useLanguageStore.setState({ language });
  applyDocument(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // 保存できなくても、この起動のあいだは反映されている
  }
}

/** OS（ブラウザ）の言語から選ぶ。初回起動で、まだ言語を選んでいないとき */
export function systemLanguage(): Language {
  return detectLanguage(systemLanguages());
}

/**
 * 起動の結果の言語を反映する。保存した言語があればそれ、初回起動なら OS の言語、
 * どちらでもなければ日本語（言語の設定がなかった版から上げた人）
 */
export function applyBootLanguage(saved: Language | null, needsSetup: boolean): Language {
  const language = saved ?? (needsSetup ? systemLanguage() : DEFAULT_LANGUAGE);
  applyLanguage(language);
  return language;
}

/** 最初の描画の前に1回: 前回の言語を <html lang> に反映する */
export function initLanguage(): void {
  applyDocument(currentLanguage());
}
