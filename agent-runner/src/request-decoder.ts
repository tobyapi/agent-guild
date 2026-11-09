// 受信した JSON オブジェクトを RunnerRequest として検証する。未知のフィールドは捨てる。
// 未知の type・不正な要求は理由つきで返す（id があれば Dispatcher が bad_request を返し、なければ記録だけする）。

import type { RunRequest } from './backends/types.ts';
import { isJsonObject, type JsonObject } from './line-parser.ts';
import type { ImagePayload, PermissionKey, Permissions, RunnerRequest, SkillPayload } from './protocol.ts';

export type DecodeResult =
  | { ok: true; request: RunnerRequest }
  | { ok: false; id: string | null; message: string };

const RUN_STRING_FIELDS = ['backend', 'workspace', 'stateDir', 'systemPrompt', 'prompt', 'model'] as const;
const PERMISSION_KEYS = [
  'webSearch',
  'webFetch',
  'readFiles',
  'writeFiles',
  'writeAnywhere',
  'runCommands',
  'skills',
] as const satisfies readonly PermissionKey[];
const SKILL_FIELDS = ['name', 'description', 'body'] as const;
const IMAGE_FIELDS = ['path', 'mediaType'] as const;

const isString = (field: unknown): field is string => typeof field === 'string';
const isBoolean = (field: unknown): field is boolean => typeof field === 'boolean';

function hasFields<K extends string, V>(
  value: JsonObject,
  keys: readonly K[],
  guard: (field: unknown) => field is V,
): value is JsonObject & Record<K, V> {
  return keys.every((key) => guard(value[key]));
}

const reject = (id: string | null, message: string): DecodeResult => ({ ok: false, id, message });

export function decodeRequest(value: JsonObject): DecodeResult {
  const id = isString(value.id) && value.id !== '' ? value.id : null;
  switch (value.type) {
    case 'run':
      return decodeRun(value, id);
    case 'login':
      return decodeLogin(value, id);
    case 'cancel':
      return id === null ? reject(null, 'cancel には id（文字列）が必要です') : { ok: true, request: { type: 'cancel', id } };
    case 'probe':
      return { ok: true, request: { type: 'probe' } };
    case 'shutdown':
      return { ok: true, request: { type: 'shutdown' } };
    default:
      return reject(id, isString(value.type) ? `未知の type です: ${value.type}` : 'type（文字列）がありません');
  }
}

function decodeLogin(value: JsonObject, id: string | null): DecodeResult {
  if (id === null) return reject(null, 'login には id（文字列）が必要です');
  if (!isString(value.backend)) return reject(id, 'login の backend は文字列である必要があります');
  return { ok: true, request: { type: 'login', id, backend: value.backend } };
}

function decodeRun(value: JsonObject, id: string | null): DecodeResult {
  if (id === null) return reject(null, 'run には id（文字列）が必要です');
  if (!hasFields(value, RUN_STRING_FIELDS, isString)) {
    const invalid = RUN_STRING_FIELDS.filter((key) => !isString(value[key]));
    return reject(id, `run の ${invalid.join('・')} は文字列である必要があります`);
  }
  const permissions = decodePermissions(value.permissions);
  const skills = decodeSkills(value.skills);
  const images = decodeImages(value.images);
  const readableDirs = decodeStrings(value.readableDirs);
  if (permissions === null) return reject(id, `run の permissions には真偽値の ${PERMISSION_KEYS.join('・')} が必要です`);
  if (skills === null) {
    return reject(id, 'run の skills は name・description・body（文字列）と dir（文字列か null）を持つ要素の配列である必要があります');
  }
  if (images === null) return reject(id, 'run の images は path・mediaType（文字列）を持つ要素の配列である必要があります');
  if (readableDirs === null) return reject(id, 'run の readableDirs は文字列の配列である必要があります');
  if (!isJsonObject(value.options)) return reject(id, 'run の options はオブジェクトである必要があります');
  const request: RunRequest = {
    type: 'run',
    id,
    backend: value.backend,
    workspace: value.workspace,
    stateDir: value.stateDir,
    readableDirs,
    systemPrompt: value.systemPrompt,
    prompt: value.prompt,
    model: value.model,
    permissions,
    skills,
    images,
    options: value.options,
  };
  return { ok: true, request };
}

function decodePermissions(value: unknown): Permissions | null {
  if (!isJsonObject(value) || !hasFields(value, PERMISSION_KEYS, isBoolean)) return null;
  const { webSearch, webFetch, readFiles, writeFiles, writeAnywhere, runCommands, skills } = value;
  return { webSearch, webFetch, readFiles, writeFiles, writeAnywhere, runCommands, skills };
}

/** dir はライブラリのフォルダ（文字列）か、アプリ内のスキルなら null。欠けていれば不正 */
const isSkillDir = (field: unknown): field is string | null => field === null || isString(field);

function decodeSkills(value: unknown): SkillPayload[] | null {
  if (!Array.isArray(value)) return null;
  const skills: unknown[] = value;
  const valid = skills.filter(
    (skill): skill is JsonObject & Record<(typeof SKILL_FIELDS)[number], string> & { dir: string | null } =>
      isJsonObject(skill) && hasFields(skill, SKILL_FIELDS, isString) && isSkillDir(skill.dir),
  );
  if (valid.length !== skills.length) return null;
  return valid.map(({ name, description, body, dir }) => ({ name, description, body, dir }));
}

function decodeImages(value: unknown): ImagePayload[] | null {
  if (!Array.isArray(value)) return null;
  const images: unknown[] = value;
  const valid = images.filter(
    (image): image is JsonObject & Record<(typeof IMAGE_FIELDS)[number], string> =>
      isJsonObject(image) && hasFields(image, IMAGE_FIELDS, isString),
  );
  if (valid.length !== images.length) return null;
  return valid.map(({ path, mediaType }) => ({ path, mediaType }));
}

function decodeStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items: unknown[] = value;
  return items.every(isString) ? items : null;
}
