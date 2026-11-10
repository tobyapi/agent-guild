/** 未取得の値は 0 と区別して、省略する。 */
export function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function nanoUsd(value: unknown): number | undefined {
  return typeof value === 'number' && value >= 0 ? count(Math.round(value * 1_000_000_000)) : undefined;
}
