import { create } from 'zustand';
import type { Profile } from '@/shared/types/domain';
import { profileApi } from './api';

interface ProfileStoreState {
  me: Profile;
}

export const useProfileStore = create<ProfileStoreState>()(() => ({
  me: { name: '', avatar: '', color: '' },
}));

export function applyProfileSnapshot(me: Profile): void {
  useProfileStore.setState({ me });
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const saved = await profileApi.update(profile);
  useProfileStore.setState({ me: saved });
  return saved;
}
