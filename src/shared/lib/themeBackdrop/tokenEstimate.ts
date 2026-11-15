import { ColorEnvelope } from './envelope';
import { resolveTextProtection } from './protection';
import type { TokenUnit } from './tokenTable';

/** Reference estimate of resolved candidates only; pending source rows prohibit a unit-level guarantee. */
export function estimateTokenUnit(unit: TokenUnit, recipe: unknown) {
  const envelope = ColorEnvelope.fromRecipe(recipe, unit.scheme, {
    underlay: unit.surface.rgb,
    usesBlackShadow: false,
  });
  const states = unit.rows.filter((row) => row.status === 'resolved' && row.text !== null);
  const estimates = states.map((row) => {
    try {
      return {
        name: row.name,
        state: row.state,
        accent: row.accent,
        ...resolveTextProtection(envelope, unit.surface.rgb, [{ text: row.text!, overlays: row.overlays }], false),
        error: null,
      };
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'text_protection_failed') throw error;
      return {
        name: row.name,
        state: row.state,
        accent: row.accent,
        alpha: 1,
        verified: false,
        error: 'text_protection_failed',
      };
    }
  });
  const limiter = estimates.reduce<(typeof estimates)[number] | null>(
    (worst, next) =>
      !worst || (worst.verified && !next.verified) || (worst.verified === next.verified && next.alpha > worst.alpha)
        ? next
        : worst,
    null,
  );
  return {
    name: unit.name,
    alpha: limiter?.alpha ?? 1,
    limiter,
    resolved: states.length,
    unresolved: unit.rows.filter((row) => row.status === 'unresolved').length,
    dynamic: unit.rows.filter((row) => row.status === 'dynamic').length,
    verified: estimates.length > 0 && estimates.every((value) => value.verified) && states.length === unit.rows.length,
  };
}
