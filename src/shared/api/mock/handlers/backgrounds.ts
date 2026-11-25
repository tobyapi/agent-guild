import { fail } from '../runtime';
import type { HandlerGroup } from './types';

function desktopOnly(): never {
  return fail('unavailable', '背景画像の保存はデスクトップアプリで利用できます');
}

export const backgroundHandlers: HandlerGroup<
  | 'generate_background_image'
  | 'generate_mascot_image'
  | 'list_mascot_images'
  | 'get_mascot_image'
  | 'delete_mascot_image'
  | 'generate_theme'
  | 'cancel_theme_generation'
  | 'cancel_background_generation'
  | 'import_background_image'
  | 'list_background_images'
  | 'get_background_image'
  | 'delete_background_image'
> = {
  generate_background_image: desktopOnly,
  generate_mascot_image: desktopOnly,
  list_mascot_images: () => [],
  get_mascot_image: desktopOnly,
  delete_mascot_image: desktopOnly,
  generate_theme: desktopOnly,
  cancel_theme_generation: () => null,
  cancel_background_generation: () => null,
  import_background_image: desktopOnly,
  list_background_images: () => [],
  get_background_image: desktopOnly,
  delete_background_image: desktopOnly,
};
