// 人格の例（エージェントのプリセット）の文言の引き方（表は言語ごとのファイル。日本語が正）
import { createTranslator } from '@/shared/i18n';
import { en } from './en';
import { ja } from './ja';
import { ko } from './ko';
import { zhHans } from './zhHans';
import { zhHant } from './zhHant';

export const tPreset = createTranslator({ ja, en, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko });

type IdOf<K> = K extends `${infer Id}.title` ? Id : never;
/** プリセットの id（翻訳表のキー「id.title」から引く） */
export type AgentPresetId = IdOf<keyof typeof ja>;
