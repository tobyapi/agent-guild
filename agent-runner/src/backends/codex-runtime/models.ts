// Codex で選べるモデルと推論の深さ。Codex CLI が取ってきて保存した一覧（$CODEX_HOME/models_cache.json）を読む。
// 表示するもの（visibility が list）を priority の順に並べ、先頭を既定のモデルにする（Codex の config.toml の既定は使わない）。
// 一覧がなければ（Codex を一度も使っていないなど）、分からないとする（モデルは自由入力）。

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ModelSpec } from '../../protocol.ts';
import { EMPTY_CATALOG, type ModelCatalog } from '../types.ts';

/** Codex SDK が受け付ける推論の深さ */
export const CODEX_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra', 'persistent'] as const;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Codex のホーム（環境変数 CODEX_HOME、なければ ~/.codex） */
export function codexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), '.codex');
}

/** models_cache.json の一覧。読めなければ EMPTY_CATALOG */
export function codexCatalog(home: string = codexHome()): ModelCatalog {
  let cache: unknown;
  try {
    cache = JSON.parse(readFileSync(join(home, 'models_cache.json'), 'utf8'));
  } catch {
    return EMPTY_CATALOG;
  }
  const models = parseModels(isObject(cache) ? cache.models : undefined);
  return { models, defaultModel: models[0]?.id ?? '' };
}

/** 表示するモデルを priority の順に（slug のないものは捨てる） */
export function parseModels(raw: unknown): ModelSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObject)
    .filter((model) => text(model.slug) !== '' && text(model.visibility) !== 'hide')
    .sort((a, b) => priority(a) - priority(b))
    .map((model) => ({
      id: text(model.slug),
      label: text(model.display_name) || text(model.slug),
      description: text(model.description),
      efforts: efforts(model.supported_reasoning_levels),
      defaultEffort: text(model.default_reasoning_level) || null,
    }));
}

function priority(model: Json): number {
  return typeof model.priority === 'number' ? model.priority : Number.MAX_SAFE_INTEGER;
}

function efforts(levels: unknown): string[] {
  if (!Array.isArray(levels)) return [];
  return levels.filter(isObject).map((level) => text(level.effort)).filter((effort) => effort !== '');
}

/** モデルの既定の深さ（一覧にないモデルなら undefined） */
export function defaultEffortOf(catalog: ModelCatalog, model: string): string | undefined {
  return catalog.models.find((spec) => spec.id === model)?.defaultEffort ?? undefined;
}
