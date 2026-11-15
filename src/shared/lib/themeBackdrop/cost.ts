import { reject } from './checks';
import { validateRecipeStructure } from './structure';

export interface DrawingCost {
  primitives: number;
  dom: number;
  definitions: number;
  movingGroups: number;
}
export interface LayerExpansion {
  cost: DrawingCost;
  patterns: { width: number; height: number; primitives: number }[];
}

// Metadata comes from app-owned drawing components, never the model Recipe.
export function validateRecipeCost(
  recipe: unknown,
  viewport: readonly number[],
  base: DrawingCost,
  layers: readonly LayerExpansion[],
): DrawingCost {
  validateRecipeStructure(recipe);
  const input = recipe as { layers: { motion: string }[] };
  if (layers.length !== input.layers.length || viewport.length !== 2 || !viewport.every(positive)) {
    reject('$', 'invalid_expansion');
  }
  const total = { ...base };
  checkBudget(total);
  layers.forEach((layer, index) => {
    if (input.layers[index]!.motion !== 'none' && layer.cost.movingGroups === 0) reject('$', 'invalid_expansion');
    for (const key of COST_KEYS) total[key] = saturatedAdd(total[key], layer.cost[key]);
    for (const pattern of layer.patterns) {
      if (
        ![pattern.width, pattern.height].every(positive) ||
        !Number.isInteger(pattern.primitives) ||
        pattern.primitives < 1
      ) {
        reject('$', 'invalid_expansion');
      }
      const cells = (Math.ceil(viewport[0]! / pattern.width) + 1) * (Math.ceil(viewport[1]! / pattern.height) + 1);
      total.primitives = saturatedAdd(total.primitives, Math.min(Number.MAX_SAFE_INTEGER, cells * pattern.primitives));
    }
    checkBudget(total);
  });
  return total;
}

const COST_KEYS = ['primitives', 'dom', 'definitions', 'movingGroups'] as const;
function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
function saturatedAdd(left: number, right: number): number {
  if (!Number.isInteger(right) || right < 0) reject('$', 'invalid_expansion');
  return Math.min(Number.MAX_SAFE_INTEGER, left + right);
}
function checkBudget(cost: DrawingCost): void {
  const limits = [2000, 400, 32, 2] as const;
  const codes = [
    'primitive_budget_exceeded',
    'dom_budget_exceeded',
    'definition_budget_exceeded',
    'motion_budget_exceeded',
  ] as const;
  COST_KEYS.forEach((key, index) => {
    if (!Number.isInteger(cost[key]) || cost[key] < 0) reject('$', 'invalid_expansion');
    if (cost[key] > limits[index]!) reject('layers', codes[index]!);
  });
}
