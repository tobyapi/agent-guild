export class RecipeValidationError extends Error {
  constructor(
    readonly field: string,
    readonly code: string,
  ) {
    super('Recipe rejected');
  }
}

export function reject(field: string, code: string): never {
  throw new RecipeValidationError(field, code);
}

export function object(value: unknown, field: string, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) reject(field, 'invalid_type');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) reject(field, 'additional_property');
  for (const key of keys) {
    if (!Object.hasOwn(result, key)) reject(field === '$' ? key : `${field}.${key}`, 'required');
  }
  return result;
}

export function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) reject(field, 'invalid_type');
  return value as unknown[];
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string') reject(field, 'invalid_type');
  return value;
}

export function number(value: unknown, field: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    reject(field, 'invalid_type');
  }
  if (value < min || value > max) reject(field, 'out_of_range');
  return value;
}

export function choice(value: unknown, field: string, choices: readonly string[], code: string): string {
  const result = text(value, field);
  if (!choices.includes(result)) reject(field, code);
  return result;
}
