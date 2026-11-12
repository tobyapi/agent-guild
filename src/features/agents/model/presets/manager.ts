import { preset } from './types';
import type { PresetEntry } from './types';

export const MANAGER_PRESETS: readonly PresetEntry[] = [
  preset('planner', 'manager', {
    avatar: '🗂️',
    color: '#91b34d',
    personality: 'efficient',
    tone: 'friendly-polite',
  }),
  preset('conductor', 'manager', {
    avatar: '🎼',
    color: '#91b34d',
    personality: 'efficient',
    tone: 'business',
  }),
  preset('reception', 'manager', {
    avatar: '🛎️',
    color: '#e680a1',
    personality: 'empathetic',
    tone: 'friendly-polite',
  }),
];
