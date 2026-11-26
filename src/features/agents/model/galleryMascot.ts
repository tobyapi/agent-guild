import { MASCOT_PRESET_MAX_LENGTH } from '@/shared/theme/mascot';
import { removeGalleryBackground, type GalleryMatte } from './galleryMatte';

// Centers of enclosed white gaps in the current gallery art, as fractions of the original frame.
const MATTES: Readonly<Record<string, GalleryMatte>> = {
  claude: {
    gaps: [
      [0.1065, 0.4306],
      [0.8397, 0.5131],
      [0.824, 0.3231],
      [0.1715, 0.4819],
      [0.8845, 0.4256],
      [0.8599, 0.3931],
      [0.25, 0.3781],
      [0.2298, 0.4719],
      [0.1693, 0.3919],
      [0.7926, 0.4594],
      [0.7769, 0.5156],
      [0.2298, 0.4994],
      [0.8016, 0.5381],
      [0.7522, 0.2731],
      [0.0863, 0.4881],
      [0.8374, 0.4819],
    ],
  },
  deepseek: {
    gaps: [
      [0.5633, 0.9294],
      [0.1989, 0.3644],
      [0.1344, 0.2944],
      [0.09, 0.4981],
      [0.3078, 0.4031],
      [0.2611, 0.2694],
      [0.2678, 0.3494],
    ],
  },
  gemini: {
    gaps: [
      [0.1626, 0.3419],
      [0.7971, 0.2556],
      [0.1334, 0.4131],
      [0.9428, 0.4869],
      [0.7365, 0.2269],
      [0.0975, 0.3806],
      [0.1962, 0.3619],
      [0.1401, 0.3094],
      [0.2231, 0.3419],
      [0.0594, 0.4431],
      [0.9742, 0.3781],
      [0.9675, 0.4369],
    ],
  },
  gpt: {
    gaps: [
      [0.7186, 0.7144],
      [0.667, 0.6131],
    ],
  },
  grok: {
    gaps: [
      [0.3038, 0.3031],
      [0.1401, 0.1956],
      [0.7926, 0.3869],
      [0.324, 0.1919],
      [0.3217, 0.4944],
      [0.4675, 0.4169],
      [0.8666, 0.3056],
      [0.6693, 0.3819],
    ],
  },
  kimi: { floorShadowFrom: 0.933 },
  minimax: {
    gaps: [
      [0.2948, 0.3731],
      [0.3217, 0.3469],
    ],
  },
  mistral: {
    gaps: [
      [0.176, 0.5906],
      [0.7365, 0.4444],
      [0.185, 0.4544],
      [0.1536, 0.3969],
      [0.2276, 0.2706],
    ],
  },
  perplexity: {
    gaps: [
      [0.8083, 0.4556],
      [0.7993, 0.3269],
      [0.7724, 0.4919],
    ],
  },
  seed: { gaps: [[0.5213, 0.7856]] },
};

export function renderGalleryMascot(bitmap: ImageBitmap, id: string): string {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  if (!removeGalleryBackground(image.data, image.width, image.height, MATTES[id])) {
    throw new Error('Gallery background could not be removed');
  }
  context.putImageData(image, 0, 0);

  for (const height of [640, 480, 360, 256, 160]) {
    const output = document.createElement('canvas');
    output.height = Math.min(height, canvas.height);
    output.width = Math.max(1, Math.round((canvas.width * output.height) / canvas.height));
    const outputContext = output.getContext('2d');
    if (!outputContext) break;
    outputContext.imageSmoothingQuality = 'high';
    outputContext.drawImage(canvas, 0, 0, output.width, output.height);
    const avatar = output.toDataURL('image/webp', 0.9);
    if (avatar.length <= MASCOT_PRESET_MAX_LENGTH) return avatar;
  }
  throw new Error('Gallery mascot exceeds the storage limit');
}
