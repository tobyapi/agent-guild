import type { Messages } from '@/shared/i18n';
import type { ja } from './ja';

export const en: Messages<typeof ja> = {
  sectionTitle: 'Appearance',
  accentLabel: 'Accent color',
  accentDefault: 'Lamp gold (default)',
  accentVermilion: 'Vermilion',
  accentSakura: 'Cherry blossom',
  accentGreen: 'Green',
  accentSky: 'Sky',
  accentViolet: 'Wisteria',
  accentSilver: 'Silver',
  backgroundLabel: 'Background',
  backgroundDefault: 'Theme default',
  backgroundNone: 'None',
  backgroundDawn: 'Dawn hills (light image)',
  backgroundNight: 'Night hills (dark image)',
  backgroundAurora: 'Aurora (animated)',
  motionLabel: 'Background motion',
  motionSystem: 'Follow OS',
  motionOff: 'Off',
};
