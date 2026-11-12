// Claude のアダプタの文字列の t()
import { createTranslator } from '../../../i18n.ts';
import { en } from './en.ts';
import { ja } from './ja.ts';
import { ko } from './ko.ts';
import { zhHans } from './zhHans.ts';
import { zhHant } from './zhHant.ts';

export const t = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });
