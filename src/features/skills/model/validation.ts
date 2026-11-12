// スキルの入力の検証（Agent Skills 標準。名前は変換せず、合わなければ直してもらう）。
import type { ErrorCode, Skill } from '@/shared/types/domain';
import { isValidSkillName, SKILL_DESCRIPTION_MAX, skillNameProblem, skillNameRule } from '@/shared/lib/skillName';
import { checkText } from '@/shared/lib/validation';
import { t } from '../i18n';

export interface SkillDraft {
  name: string;
  description: string;
  body: string;
}

export type SkillField = keyof SkillDraft;

export { skillNameRule };

function checkName(draft: SkillDraft, existing: readonly Skill[], selfId: string | null): string | null {
  if (!isValidSkillName(draft.name)) return skillNameProblem();
  const duplicate = existing.some((skill) => skill.name === draft.name && skill.id !== selfId);
  return duplicate ? t('nameDuplicate') : null;
}

/** existing は同じエージェントのスキル、selfId は編集中のスキル（新規なら null） */
export function validateSkillDraft(
  draft: SkillDraft,
  existing: readonly Skill[],
  selfId: string | null,
): Partial<Record<SkillField, string>> {
  const entries: Array<[SkillField, string | null]> = [
    ['name', checkName(draft, existing, selfId)],
    [
      'description',
      checkText(draft.description, { label: t('descriptionLabel'), required: true, max: SKILL_DESCRIPTION_MAX }),
    ],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [SkillField, string] => entry[1] !== null));
}

const SKILL_FIELDS: readonly SkillField[] = ['name', 'description', 'body'];

/**
 * 保存で返ったエラーがどの入力のことか（分からなければ null。フォームの先頭の帯に出す）。
 * validation は CommandError.field で、conflict（同じエージェントに同じ名前のスキル）は名前の問題
 */
export function skillErrorField(code: ErrorCode | null, field: string | null): SkillField | null {
  if (code === 'conflict') return 'name';
  if (code !== 'validation') return null;
  return SKILL_FIELDS.find((known) => known === field) ?? null;
}
