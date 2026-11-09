import { checkAvatar } from '@/shared/lib/avatar';
import { isHexColor } from '@/shared/lib/colors';
import { checkMemberName } from '@/shared/lib/names';
import type { Profile } from '@/shared/types/domain';

export type ProfileField = keyof Profile;

/**
 * プロフィールの検証。名前の規則はエージェント名と同じ（design.md §2）。
 * takenNames は削除されていないエージェントの名前。
 */
export function validateProfile(
  profile: Profile,
  takenNames: readonly string[],
): Partial<Record<ProfileField, string>> {
  const entries: Array<[ProfileField, string | null]> = [
    ['name', checkMemberName(profile.name, takenNames)],
    ['avatar', checkAvatar(profile.avatar)],
    ['color', isHexColor(profile.color) ? null : '色を選んでください'],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [ProfileField, string] => entry[1] !== null));
}
