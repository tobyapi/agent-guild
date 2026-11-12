// run と image の要求に添えるスキル（SkillPayload）の検証。request-decoder.ts と image-request-decoder.ts から呼ぶ。

import { isJsonObject, type JsonObject } from './line-parser.ts';
import type { SkillFilePayload, SkillPayload } from './protocol.ts';

const SKILL_FIELDS = ['name', 'description', 'body'] as const;
const SKILL_FILE_FIELDS = ['path', 'content'] as const;

const isString = (field: unknown): field is string => typeof field === 'string';

const hasStrings = <K extends string>(value: JsonObject, keys: readonly K[]): value is JsonObject & Record<K, string> =>
  keys.every((key) => isString(value[key]));

/** dir はライブラリのフォルダ（文字列）か、アプリ内のスキルなら null。欠けていれば不正 */
const isSkillDir = (field: unknown): field is string | null => field === null || isString(field);

/** スキルの配列。要素の name・description・body（文字列）・dir（文字列か null）・files が欠けていれば null */
export function decodeSkills(value: unknown): SkillPayload[] | null {
  if (!Array.isArray(value)) return null;
  const skills: unknown[] = value;
  const decoded: SkillPayload[] = [];
  for (const skill of skills) {
    if (!isJsonObject(skill) || !hasStrings(skill, SKILL_FIELDS) || !isSkillDir(skill.dir)) return null;
    const files = decodeSkillFiles(skill.files);
    if (files === null) return null;
    const { name, description, body, dir } = skill;
    decoded.push({ name, description, body, dir, files });
  }
  return decoded;
}

/** 内蔵スキルの付属ファイル（path と content の文字列）。欠けていれば不正 */
function decodeSkillFiles(value: unknown): SkillFilePayload[] | null {
  if (!Array.isArray(value)) return null;
  const files: unknown[] = value;
  const valid = files.filter(
    (file): file is JsonObject & Record<(typeof SKILL_FILE_FIELDS)[number], string> =>
      isJsonObject(file) && hasStrings(file, SKILL_FILE_FIELDS),
  );
  if (valid.length !== files.length) return null;
  return valid.map(({ path, content }) => ({ path, content }));
}
