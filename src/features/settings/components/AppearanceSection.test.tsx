// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { setAccent } from '../accentStore';
import { AppearanceSection } from './AppearanceSection';

afterEach(() => {
  cleanup();
  setAccent('default');
});

it('アクセントの色の見本を選ぶと <html data-accent> に反映し、既定に戻すと属性を外す', () => {
  render(<AppearanceSection />);
  const group = screen.getByRole('radiogroup', { name: 'アクセントの色' });
  expect(group.querySelectorAll('[role="radio"]')).toHaveLength(7);
  expect(screen.getByRole('radio', { name: '灯の金（既定）' }).getAttribute('aria-checked')).toBe('true');

  fireEvent.click(screen.getByRole('radio', { name: '空' }));
  expect(document.documentElement.dataset.accent).toBe('sky');
  expect(screen.getByRole('radio', { name: '空' }).getAttribute('aria-checked')).toBe('true');

  fireEvent.keyDown(screen.getByRole('radio', { name: '空' }), { key: 'ArrowRight' });
  expect(document.documentElement.dataset.accent).toBe('violet');

  fireEvent.click(screen.getByRole('radio', { name: '灯の金（既定）' }));
  expect(document.documentElement.dataset.accent).toBeUndefined();
});
