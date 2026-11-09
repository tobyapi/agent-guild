import { invoke } from '@/shared/api';
import type { Profile } from '@/shared/types/domain';

export const profileApi = {
  update: (profile: Profile) => invoke('update_profile', { profile }),
};
