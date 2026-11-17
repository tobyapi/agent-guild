import { t } from './api/texts.ts';
import { createApiAdapter } from './api/adapter.ts';
import { deepseekCodec } from './deepseek/codec.ts';

// Official model/effort catalog checked 2026-11-17; sources are recorded in docs/deepseek-gemini.md.
export const deepseekAdapter = createApiAdapter({
  id: 'deepseek',
  label: 'DeepSeek',
  envVar: 'DEEPSEEK_API_KEY',
  codec: deepseekCodec,
  catalog: () => ({
    defaultModel: 'deepseek-flash',
    models: [
      ['deepseek-flash', 'DeepSeek Flash'],
      ['deepseek-v4-pro', 'DeepSeek V4 Pro'],
    ].map(([id, label]) => ({
      id: id!,
      label: label!,
      description: t('limits'),
      efforts: ['low', 'high', 'max'],
      defaultEffort: 'high',
      tools: true,
    })),
  }),
});
