// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { defaultAppearance } from '@/shared/theme/registry';
import { AppearanceBackdrop } from './AppearanceBackdrop';

vi.mock('@/features/settings', () => ({
  useAppearanceStore: () => ({
    ...defaultAppearance(),
    backgroundOverride: { kind: 'generated', presetId: 'tile-turtle' },
  }),
}));
afterEach(cleanup);

it('renders no background for a retired preset', () => {
  const { container } = render(<AppearanceBackdrop />);
  expect(container.childElementCount).toBe(0);
});
