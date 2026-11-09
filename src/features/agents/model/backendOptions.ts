// バックエンド固有設定（BackendInfo.options の OptionSpec）を汎用フォームで扱う（docs/ui-design.md §5.10）。
// 入力中の値は、boolean はそのまま、それ以外は文字列で持つ。値がない・空欄 = 既定値（キーを保存しない）。
import type { OptionSpec } from '@/shared/types/domain';

export type OptionValue = string | boolean;
export type OptionValues = Readonly<Record<string, OptionValue>>;

/** 保存されている backendOptions を入力値にする（スキーマにないキー・型の合わない値は捨てる） */
export function optionValuesFrom(specs: readonly OptionSpec[], stored: Readonly<Record<string, unknown>>): OptionValues {
  const entries = specs.flatMap((spec): Array<[string, OptionValue]> => {
    const value = stored[spec.key];
    if (spec.type === 'boolean') return typeof value === 'boolean' ? [[spec.key, value]] : [];
    return typeof value === 'string' || typeof value === 'number' ? [[spec.key, String(value)]] : [];
  });
  return Object.fromEntries(entries);
}

/** 既定値の表示（「既定: 30」のプレースホルダや「（既定）」の印に使う） */
export function defaultLabel(spec: OptionSpec): string {
  return spec.default === null ? '' : String(spec.default);
}

/** 入力値が既定と違うか（詳細設定を開いておくか・「既定に戻す」を出すかの判断） */
export function isCustomized(spec: OptionSpec, values: OptionValues): boolean {
  const value = values[spec.key];
  if (value === undefined || value === '') return false;
  return String(value) !== defaultLabel(spec);
}

type Parsed = { ok: true; value: unknown } | { ok: false; error: string } | null;

/** 1項目を保存する値にする。既定のままなら null（キーを入れない） */
function parseOne(spec: OptionSpec, raw: OptionValue | undefined): Parsed {
  if (raw === undefined || raw === '' || !isCustomized(spec, { [spec.key]: raw })) return null;
  if (spec.type === 'boolean') return { ok: true, value: raw === true };
  const text = String(raw).trim();
  if (spec.type === 'number') {
    const number = Number(text);
    return Number.isFinite(number) ? { ok: true, value: number } : { ok: false, error: '数値を入力してください' };
  }
  if (spec.type === 'select' && !spec.choices.includes(text)) return { ok: false, error: '選択肢から選んでください' };
  return { ok: true, value: text };
}

export interface ParsedOptions {
  options: Record<string, unknown>;
  /** OptionSpec.key → エラー */
  errors: Record<string, string>;
}

/** 入力値を backendOptions にする */
export function parseOptionValues(specs: readonly OptionSpec[], values: OptionValues): ParsedOptions {
  const result: ParsedOptions = { options: {}, errors: {} };
  for (const spec of specs) {
    const parsed = parseOne(spec, values[spec.key]);
    if (parsed === null) continue;
    if (parsed.ok) result.options[spec.key] = parsed.value;
    else result.errors[spec.key] = parsed.error;
  }
  return result;
}
