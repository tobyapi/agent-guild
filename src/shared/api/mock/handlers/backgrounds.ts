import { fail } from '../runtime';
import type { HandlerGroup } from './types';

function desktopOnly(): never {
  return fail('unavailable', '背景画像の保存はデスクトップアプリで利用できます');
}

export const backgroundHandlers: HandlerGroup<
  'import_background_image' | 'list_background_images' | 'get_background_image' | 'delete_background_image'
> = {
  import_background_image: desktopOnly,
  list_background_images: () => [],
  get_background_image: desktopOnly,
  delete_background_image: desktopOnly,
};
