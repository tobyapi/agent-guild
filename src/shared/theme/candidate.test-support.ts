import fixture from '../../../contracts/ipc/theme-candidate.json';
import { parseCandidate, type SavedTheme } from './candidate';

export const candidate = parseCandidate(JSON.stringify(fixture));
export const imageId = '12345678-1234-1234-1234-123456789abc';
export function savedTheme() {
  const { name, variants, corners, typeStyle, schemaVersion } = candidate;
  return {
    name,
    variants,
    corners,
    typeStyle,
    schemaVersion,
    id: 'user-' + imageId,
    backgroundId: imageId,
  } satisfies SavedTheme;
}
