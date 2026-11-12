// ランナーの共通の文字列の t()（途中経過・Dispatcher と共通部品のエラー）
import { createTranslator } from '../i18n.ts';
import { en } from './en.ts';
import { ja } from './ja.ts';
import { ko } from './ko.ts';
import { zhHans } from './zhHans.ts';
import { zhHant } from './zhHant.ts';

export const t = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });
