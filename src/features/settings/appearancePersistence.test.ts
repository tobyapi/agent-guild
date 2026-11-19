// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { defaultAppearance } from '@/shared/theme/registry';
import { appearanceHarness, storedLibrary } from './appearance.test-support';
import { LIBRARY_KEY } from './themeLibrary';

it('reads only the v3 library and retains its version 2 preference', () => {
  const active = { ...defaultAppearance(), accentOverride: 'sky', schemePreference: 'light' };
  const h = appearanceHarness({ [LIBRARY_KEY]: storedLibrary(active), 'agent-guild.appearance.v2': 'broken' });
  h.controller.init();
  expect(h.storage.getItem.mock.calls).toEqual([[LIBRARY_KEY]]);
  expect(h.controller.store.getState().active).toEqual(active);
});
it('initializes the library with the first-run default', () => {
  const h = appearanceHarness({ 'agent-guild.theme': 'light' });
  h.controller.init();
  expect(h.storage.getItem.mock.calls).toEqual([[LIBRARY_KEY]]);
  expect(h.controller.store.getState().active).toEqual(defaultAppearance());
});
