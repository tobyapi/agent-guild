import { create } from 'zustand';
import type { Profile } from '@/shared/types/domain';
import { profileApi } from './api';

interface ProfileStoreState {
  me: Profile;
}

export const useProfileStore = create<ProfileStoreState>()(() => ({
  me: { name: '', avatar: '', color: '', frame: '' },
}));

/** いまのプロフィール（描画の外から読む。届いた発言が自分宛てかの判定などに使う） */
export function currentProfile(): Profile {
  return useProfileStore.getState().me;
}

export function applyProfileSnapshot(me: Profile): void {
  useProfileStore.setState({ me });
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const saved = await profileApi.update(profile);
  useProfileStore.setState({ me: saved });
  return saved;
}
