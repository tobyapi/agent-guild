// agents の頭脳・できること・自発活動・検証の文言の引き方（表は言語ごとのファイル。日本語が正）
import { createTranslator } from '@/shared/i18n';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zhHans } from './zhHans';
import { zhHant } from './zhHant';

export const tBrain = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });
