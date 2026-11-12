import { invoke } from '@/shared/api';

export const framesApi = {
  generate: (backendId: string, description: string, name: string) =>
    invoke('generate_avatar_frame', { backendId, description, name }),
  cancelGeneration: () => invoke('cancel_avatar_frame_generation'),
  image: (id: string) => invoke('get_frame_image', { id }),
  remove: (id: string) => invoke('delete_avatar_frame', { id }),
};
