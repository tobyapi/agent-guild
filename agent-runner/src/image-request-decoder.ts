// image 要求（画像を1枚描く）の検証。未知のフィールドは捨てる。request-decoder.ts から呼ぶ。

import type { DecodeResult } from './request-decoder.ts';
import type { JsonObject } from './line-parser.ts';
import { decodeSkills } from './skill-payload-decoder.ts';

const IMAGE_STRING_FIELDS = ['backend', 'workspace', 'stateDir', 'systemPrompt', 'prompt', 'output'] as const;
type ImageField = (typeof IMAGE_STRING_FIELDS)[number];

const hasStrings = (value: JsonObject): value is JsonObject & Record<ImageField, string> =>
  IMAGE_STRING_FIELDS.every((key) => typeof value[key] === 'string');

export function decodeImage(value: JsonObject, id: string | null): DecodeResult {
  if (id === null) return { ok: false, id: null, message: 'image には id（文字列）が必要です' };
  if (!hasStrings(value)) {
    const invalid = IMAGE_STRING_FIELDS.filter((key) => typeof value[key] !== 'string');
    return { ok: false, id, message: `image の ${invalid.join('・')} は文字列である必要があります` };
  }
  const { backend, workspace, stateDir, systemPrompt, prompt, output } = value;
  if (output === '') return { ok: false, id, message: 'image の output は空にできません' };
  const skills = decodeSkills(value.skills);
  if (skills === null) {
    const message =
      'image の skills は name・description・body（文字列）と dir（文字列か null）を持つ要素の配列である必要があります';
    return { ok: false, id, message };
  }
  return {
    ok: true,
    request: { type: 'image', id, backend, workspace, stateDir, systemPrompt, prompt, skills, output },
  };
}
