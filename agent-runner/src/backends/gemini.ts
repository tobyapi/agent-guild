import { t } from './api/texts.ts';
import { createApiAdapter } from './api/adapter.ts';
import { geminiCodec } from './gemini/codec.ts';

// Gemini Developer API only. Vertex AI and GOOGLE_API_KEY are intentionally separate from this backend.
export const geminiAdapter = createApiAdapter({
  id: 'gemini',
  label: 'Gemini (Developer API)',
  envVar: 'GEMINI_API_KEY',
  codec: geminiCodec,
  catalog: () => ({
    defaultModel: 'gemini-4-hydrogen',
    models: [
      ['gemini-4-hydrogen', 'Gemini 4 Hydrogen', ['low', 'medium', 'high', 'xhigh']],
      ['gemini-4-argon', 'Gemini 4 Argon', ['low', 'medium', 'high']],
      ['gemini-4-carbon', 'Gemini 4 Carbon', ['low', 'medium', 'high']],
    ].map(([id, label, efforts]) => ({
      id: id as string,
      label: label as string,
      description: t('limits'),
      efforts: efforts as string[],
      defaultEffort: 'high',
      tools: true,
    })),
  }),
});
