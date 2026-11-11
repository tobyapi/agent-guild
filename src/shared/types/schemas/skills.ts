// domain のスキル（エージェントのスキル・スキルライブラリ）のスキーマ。
import type {
  BuiltinSkill,
  BuiltinSkillSource,
  LibrarySkill,
  LinkedSkillSource,
  Skill,
  SkillInput,
  SkillLibrary,
} from '../domain';
import { anyOf, arrayOf, nullable, number, objectOf, oneOf, recordOf, string } from '../schema';
import type { Schema } from '../schema';

const linkedSourceSchema = {
  kind: oneOf<LinkedSkillSource['kind']>({ linked: true }),
  path: string,
} satisfies Schema<LinkedSkillSource>;

const builtinSourceSchema = {
  kind: oneOf<BuiltinSkillSource['kind']>({ builtin: true }),
  name: string,
} satisfies Schema<BuiltinSkillSource>;

const skillSource = anyOf(objectOf(linkedSourceSchema), objectOf(builtinSourceSchema));

export const builtinSkillSchema = {
  name: string,
  description: string,
  body: string,
  files: arrayOf(string),
} satisfies Schema<BuiltinSkill>;

export const skillSchema = {
  id: string,
  agentId: string,
  name: string,
  description: string,
  body: string,
  source: nullable(skillSource),
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
