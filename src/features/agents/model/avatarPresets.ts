import type { SourceRect } from '@/shared/lib/crop';
import { loadAvatarImage, renderAvatarImage } from '@/shared/lib/image';

export const AVATAR_GALLERY = 'https://genderswapai.com/ja/ai-gijinka';
const IMAGE_DIRECTORY = 'https://genderswapai.com/images/ai-gijinka';
const SOURCE_HEIGHT = 1600;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

export interface AvatarPreset {
  id: string;
  name: string;
  crop: SourceRect;
}

/** 図鑑の掲載順。元画像（高さ1600px）の顔と髪飾りを収める範囲。 */
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'deepseek', name: 'DeepSeek', crop: { sx: 260, sy: 23, size: 380 } },
  { id: 'gpt', name: 'ChatGPT / GPT', crop: { sx: 253, sy: 0, size: 375 } },
  { id: 'claude', name: 'Claude', crop: { sx: 312, sy: 0, size: 290 } },
  { id: 'grok', name: 'Grok', crop: { sx: 363, sy: 157, size: 340 } },
  { id: 'gemini', name: 'Gemini', crop: { sx: 265, sy: 56, size: 366 } },
  { id: 'kimi', name: 'Kimi', crop: { sx: 310, sy: 53, size: 345 } },
  { id: 'glm', name: 'GLM', crop: { sx: 283, sy: 64, size: 368 } },
  { id: 'qwen', name: 'Qwen', crop: { sx: 285, sy: 41, size: 342 } },
  { id: 'seed', name: 'Seed / Doubao', crop: { sx: 267, sy: 51, size: 330 } },
  { id: 'minimax', name: 'MiniMax', crop: { sx: 229, sy: 33, size: 358 } },
  { id: 'llama', name: 'Llama', crop: { sx: 261, sy: 7, size: 374 } },
  { id: 'mistral', name: 'Mistral', crop: { sx: 264, sy: 24, size: 376 } },
  { id: 'perplexity', name: 'Perplexity', crop: { sx: 335, sy: 155, size: 300 } },
  { id: 'wenxin', name: 'ERNIE / 文心', crop: { sx: 302, sy: 122, size: 342 } },
  { id: 'jev', name: 'JEV', crop: { sx: 277, sy: 35, size: 347 } },
];

/** 図鑑から取得し、通常の画像アバターと同じ正方形の data URL にする。 */
export async function loadPresetAvatar(preset: AvatarPreset, signal: AbortSignal): Promise<string> {
  const response = await fetch(`${IMAGE_DIRECTORY}/${preset.id}.webp`, {
    signal,
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok || Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) {
    throw new Error('図鑑の画像を取得できませんでした');
  }
  const blob = await response.blob();
  if (blob.size > MAX_SOURCE_BYTES) throw new Error('図鑑の画像が大きすぎます');
  const bitmap = await loadAvatarImage(new File([blob], `${preset.id}.webp`, { type: blob.type }));
  try {
    const scale = bitmap.height / SOURCE_HEIGHT;
    const size = Math.min(preset.crop.size * scale, bitmap.width, bitmap.height);
    return renderAvatarImage(bitmap, {
      sx: Math.min(preset.crop.sx * scale, bitmap.width - size),
      sy: Math.min(preset.crop.sy * scale, bitmap.height - size),
      size,
    });
  } finally {
    bitmap.close();
  }
}
