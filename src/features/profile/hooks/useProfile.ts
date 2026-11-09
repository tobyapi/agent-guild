import type { Profile } from '@/shared/types/domain';
import { useProfileStore } from '../store';

export function useProfile(): Profile {
  return useProfileStore((state) => state.me);
}
