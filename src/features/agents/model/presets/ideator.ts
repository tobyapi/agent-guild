import { preset } from './types';
import type { PresetEntry } from './types';

export const IDEATOR_PRESETS: readonly PresetEntry[] = [
  preset('idea-maker', 'ideator', {
    avatar: '💡',
    color: '#bfdc73',
    personality: 'curious',
    tone: 'friendly-polite',
  }),
  preset('new-angle', 'ideator', {
    avatar: '🪄',
    color: '#b191ea',
    personality: 'ideas',
    tone: 'casual',
  }),
];
