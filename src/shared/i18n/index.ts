// 画面の固定の文字列の多言語化。各 feature（や shared の部品）は i18n/ に言語ごとの表を置き、
// createTranslator で作った t() から引く。日本語の表が正で、ほかの言語は同じキーをすべて持つ（型で検査する）。
export { DEFAULT_LANGUAGE, detectLanguage, LANGUAGES, languageOfTag, parseLanguage } from './languages';
export type { LanguageOption } from './languages';
export {
  applyBootLanguage,
  applyLanguage,
  currentLanguage,
  initLanguage,
  LANGUAGE_STORAGE_KEY,
  systemLanguage,
  useLanguage,
} from './store';
export { createTranslator, format } from './translate';
export type { Dictionary, Message, Messages, Params, Translations } from './translate';
