import { MAX_IMAGE_BYTES } from '@/shared/lib/limits';

export class BackgroundInputError extends Error {
  constructor(readonly reason: 'backgroundTooLarge' | 'backgroundFormat' | 'backgroundBroken') {
    super(reason);
  }
}

/** Match attachments' FileReader/raw-base64 transport; decoding stays in Rust. */
export function readBackground(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) return Promise.reject(new BackgroundInputError('backgroundTooLarge'));
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    return Promise.reject(new BackgroundInputError('backgroundFormat'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result.slice(reader.result.indexOf(',') + 1));
      else reject(new BackgroundInputError('backgroundBroken'));
    };
    reader.onerror = () => reject(new BackgroundInputError('backgroundBroken'));
    reader.readAsDataURL(file);
  });
}
