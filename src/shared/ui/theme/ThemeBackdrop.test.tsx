// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ThemeBackdrop } from './ThemeBackdrop';

afterEach(cleanup);

it('rejects missing and non-library backgrounds', () => {
  const { container, rerender } = render(
    <ThemeBackdrop background={{ kind: 'none' }} imageUrl="data:image/png;base64,cGl4ZWw=" />,
  );
  expect(container.childElementCount).toBe(0);
  rerender(<ThemeBackdrop background={{ kind: 'image', assetId: 'dawn' }} imageUrl="data:image/png;base64,cGl4ZWw=" />);
  expect(container.querySelectorAll('button,input,a,[tabindex]')).toHaveLength(0);
  expect(container.childElementCount).toBe(0);
  rerender(
    <ThemeBackdrop
      background={{ kind: 'image', assetId: 'https://example.com/a.svg' }}
      imageUrl="data:image/png;base64,cGl4ZWw="
    />,
  );
  expect(container.childElementCount).toBe(0);
});
