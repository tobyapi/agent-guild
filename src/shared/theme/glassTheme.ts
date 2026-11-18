import { ColorEnvelope } from '../lib/themeBackdrop/envelope';
import { mix, rgb, worstRatio } from './themeColors';
import type { Scheme } from './types';

export const GLASS_TEXT_MIN = 4.6;
export const FOCUS_MIN = 3;

// Match tokens-glass.css. Blur averages pixels, so the full RGB domain also bounds the blurred backdrop.
export function glassBounds(scheme: Scheme): ColorEnvelope {
  const [color, opacity] = scheme === 'dark' ? (['#080a0e', 0.74] as const) : (['#ffffff', 0.8] as const);
  return ColorEnvelope.fullRgb().over(rgb(color), opacity).roundedOut();
}

export function glassInk(color: string, scheme: Scheme, bounds: ColorEnvelope, minimum: number): string {
  if (worstRatio(color, bounds) >= minimum) return color;
  const endpoint = scheme === 'dark' ? '#ffffff' : '#000000';
  // Move only as far toward the endpoint as the rounded 8-bit ink needs to pass.
  let low = 0;
  let high = 256;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (worstRatio(mix(color, endpoint, mid / 256), bounds) >= minimum) high = mid;
    else low = mid;
  }
  return mix(color, endpoint, high / 256);
}
