// 契約の値を実行時に検証する小さな部品。
// Schema<T> は T のすべてのキーに検証関数を要求するので、domain.ts にキーを足して
// schemas/ を直し忘れると `satisfies Schema<T>` が型エラーになる（余分なキーも同様）。

/** 問題があれば「パス: 内容」の一覧を、なければ空配列を返す */
export type Validator = (value: unknown, path: string) => string[];

export type Schema<T> = { readonly [K in keyof T]-?: Validator };

const problem = (path: string, expected: string) => [`${path}: ${expected}ではありません`];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const string: Validator = (value, path) => (typeof value === 'string' ? [] : problem(path, '文字列'));

export const number: Validator = (value, path) =>
  typeof value === 'number' && Number.isFinite(value) ? [] : problem(path, '数値');

export const boolean: Validator = (value, path) => (typeof value === 'boolean' ? [] : problem(path, '真偽値'));

export const nullValue: Validator = (value, path) => (value === null ? [] : problem(path, 'null'));

/** 中身を問わない（unknown として扱う値） */
export const anything: Validator = () => [];

export function nullable(inner: Validator): Validator {
  return (value, path) => (value === null ? [] : inner(value, path));
}

/** どれかに合えばよい */
export function anyOf(...validators: Validator[]): Validator {
  return (value, path) =>
    validators.some((validate) => validate(value, path).length === 0) ? [] : problem(path, '許された型');
}

/**
 * 文字列の列挙。選択肢を Record<T, true> で受け取るので、型の選択肢を書き漏らすとコンパイルエラーになる。
 * 使い方: oneOf<AgentKind>({ worker: true, expert: true })
 */
export function oneOf<T extends string>(choices: Record<T, true>): Validator {
  const allowed: readonly string[] = Object.keys(choices);
  return (value, path) =>
    typeof value === 'string' && allowed.includes(value) ? [] : problem(path, `${allowed.join(' / ')} のどれか`);
}

export function arrayOf(item: Validator): Validator {
  return (value, path) =>
    Array.isArray(value) ? value.flatMap((entry, index) => item(entry, `${path}[${index}]`)) : problem(path, '配列');
}

export function recordOf(item: Validator): Validator {
  return (value, path) =>
    isRecord(value)
      ? Object.entries(value).flatMap(([key, entry]) => item(entry, `${path}.${key}`))
      : problem(path, 'オブジェクト');
}

/** オブジェクト: すべてのキーを検証し、契約にないキーも問題として報告する */
export function objectOf<T>(schema: Schema<T>): Validator {
  const entries: ReadonlyArray<[string, Validator]> = Object.entries(schema);
  return (value, path) => {
    if (!isRecord(value)) return problem(path, 'オブジェクト');
    const invalid = entries.flatMap(([key, validate]) => validate(value[key], `${path}.${key}`));
    const unknown = Object.keys(value)
      .filter((key) => !entries.some(([known]) => known === key))
      .map((key) => `${path}.${key}: 契約にないキーです`);
    return [...invalid, ...unknown];
  };
}

/** 一部のキーを除いたスキーマ（AgentInput = Omit<Agent, …> などに使う） */
export function omitKeys<T, K extends keyof T>(schema: Schema<T>, keys: readonly K[]): Schema<Omit<T, K>> {
  const omitted: readonly PropertyKey[] = keys;
  const kept = Object.entries(schema).filter(([key]) => !omitted.includes(key));
  return Object.fromEntries(kept) as Schema<Omit<T, K>>;
}
