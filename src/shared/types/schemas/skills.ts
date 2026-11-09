// domain のスキル（エージェントのスキル・スキルライブラリ）のスキーマ。
import type { LibrarySkill, Skill, SkillInput, SkillLibrary, SkillSource } from '../domain';
import { arrayOf, nullable, number, objectOf, oneOf, recordOf, string } from '../schema';
import type { Schema } from '../schema';

export const skillSourceSchema = {
  kind: oneOf<SkillSource['kind']>({ linked: true }),
  path: string,
} satisfies Schema<SkillSource>;

export const skillSchema = {
  id: string,
  agentId: string,
  name: string,
  description: string,
  body: string,
  source: nullable(objectOf(skillSourceSchema)),
  problem: nullable(string),
  updatedAt: number,
} satisfies Schema<Skill>;

export const skillInputSchema = {
  id: nullable(string),
  agentId: string,
  name: string,
  description: string,
  body: string,
} satisfies Schema<SkillInput>;

export const librarySkillSchema = {
  path: string,
  libraryDir: string,
  name: string,
  description: string,
  fileCount: number,
  problem: nullable(string),
} satisfies Schema<LibrarySkill>;

export const skillLibrarySchema = {
  dirs: arrayOf(string),
  skills: arrayOf(objectOf(librarySkillSchema)),
  dirProblems: recordOf(string),
} satisfies Schema<SkillLibrary>;

export const skillsChangedSchema = { agentId: string } satisfies Schema<{ agentId: string }>;
