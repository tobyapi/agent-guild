import type { ThemeCandidate, SavedTheme } from './candidate';

export const candidate: ThemeCandidate = {
  schemaVersion: 1,
  name: '夜の図書館',
  corners: 'soft',
  typeStyle: 'serifHeadings',
  variants: {
    dark: { surface: '#131316', text: '#ffffff', muted: '#d2d2d2', accent: '#f0ce94' },
    light: { surface: '#fffefa', text: '#111111', muted: '#383839', accent: '#51360d' },
  },
  background: { kind: 'generate', description: 'Quiet library at night' },
};
export const imageId = '12345678-1234-1234-1234-123456789abc';
export function savedTheme(): SavedTheme {
  const { name, variants, corners, typeStyle, schemaVersion } = candidate;
  return { name, variants, corners, typeStyle, schemaVersion, id: 'user-' + imageId, backgroundId: imageId };
}
