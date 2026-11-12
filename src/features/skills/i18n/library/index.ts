// 内蔵スキル・ライブラリ・スキルのフォルダの文言の引き方（日本語が正）
import { createTranslator } from '@/shared/i18n';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zhHans } from './zhHans';
import { zhHant } from './zhHant';

export const tLibrary = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });
