import type { AvatarPresetId } from '@/features/agents';

export const ARTIST_TERMS = 'https://www.pixiv.net/artworks/148186519';
export const DEEPSEEK_LICENSE = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
export const DEEPSEEK_ORIGINAL_CHARACTER = 'https://www.bilibili.com/opus/1231977657712771073';

const FIRST_POST = 'https://www.bilibili.com/opus/1233069202138464289';
const SECOND_POST = 'https://www.bilibili.com/opus/1236803362705375305';

export const GALLERY_ORIGINAL_POSTS = {
  deepseek: FIRST_POST,
  gpt: FIRST_POST,
  claude: FIRST_POST,
  grok: FIRST_POST,
  gemini: FIRST_POST,
  kimi: FIRST_POST,
  glm: FIRST_POST,
  qwen: FIRST_POST,
  seed: SECOND_POST,
  minimax: SECOND_POST,
  llama: SECOND_POST,
  mistral: SECOND_POST,
  perplexity: SECOND_POST,
  wenxin: SECOND_POST,
  jev: 'https://www.bilibili.com/opus/1253808555541135367',
} satisfies Record<AvatarPresetId, string>;
