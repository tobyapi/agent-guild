// スキルの規則（Agent Skills の SKILL.md 標準。docs/design.md §2 入力規則）。
// 名前は勝手に変換しない。合わなければ利用者に直してもらう（サーバも validation で拒否する）。
import { t } from './i18n';

export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;

/** 規則の説明（「スキル名は…」に続ける。いまの言語で返す） */
export function skillNameRule(): string {
  return t('skillNameRule', { max: SKILL_NAME_MAX });
}

/** 名前が規則に合わないときに出す文（「スキル名は」＋規則の説明） */
export function skillNameProblem(): string {
  return t('skillNameProblem', { rule: skillNameRule() });
}

/** 英小文字・数字・ハイフン。先頭と末尾にハイフンは置けず、ハイフンは連続させない */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSkillName(name: string): boolean {
  return name.length <= SKILL_NAME_MAX && SKILL_NAME.test(name);
}
