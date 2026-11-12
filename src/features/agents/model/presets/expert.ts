import { preset } from './types';
import type { PresetEntry } from './types';

export const EXPERT_PRESETS: readonly PresetEntry[] = [
  preset('editor', 'expert', {
    avatar: '🖍️',
    color: '#ea856b',
    personality: 'perfectionist',
    tone: 'polite',
  }),
  preset('security', 'expert', {
    avatar: '🛡️',
    color: '#7ca2f6',
    personality: 'careful',
    tone: 'business',
  }),
  preset('designer', 'expert', {
    avatar: '🎨',
    color: '#d285cb',
    personality: 'empathetic',
    tone: 'teacher',
  }),
  preset('analyst', 'expert', {
    avatar: '📊',
    color: '#cb9d2a',
    personality: 'calm',
    tone: 'reasoning',
  }),
  preset('devils-advocate', 'expert', {
    avatar: '🦔',
    color: '#ea856b',
    personality: 'blunt',
    tone: 'reasoning',
  }),
  preset('first-timer', 'expert', {
    avatar: '🙋',
    color: '#22b5e1',
    personality: 'cheerful',
    tone: 'casual',
  }),
  preset('non-technical-user', 'expert', {
    avatar: '👴',
    color: '#b191ea',
    personality: 'easygoing',
    tone: 'gentle',
  }),
];
