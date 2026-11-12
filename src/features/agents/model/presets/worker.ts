import { preset } from './types';
import type { PresetEntry } from './types';

export const WORKER_PRESETS: readonly PresetEntry[] = [
  preset('researcher', 'worker', {
    avatar: '🔭',
    color: '#22b5e1',
    personality: 'curious',
    tone: 'polite',
  }),
  preset('writer', 'worker', {
    avatar: '✍️',
    color: '#e680a1',
    personality: 'perfectionist',
    tone: 'gentle',
  }),
  preset('engineer', 'worker', {
    avatar: '💻',
    color: '#00beb7',
    personality: 'craftsman',
    tone: 'terse',
  }),
  preset('web-researcher', 'worker', {
    avatar: '🔎',
    color: '#00beb7',
    personality: 'careful',
    tone: 'polite',
  }),
  preset('market-researcher', 'worker', {
    avatar: '📈',
    color: '#cb9d2a',
    personality: 'logical',
    tone: 'terse',
  }),
  preset('minutes', 'worker', {
    avatar: '🖋️',
    color: '#9199a5',
    personality: 'calm',
    tone: 'polite',
  }),
];
