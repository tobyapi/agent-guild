// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { initAppearance, setBackground } from '@/features/settings';
import { advance, bootApp, closeApp } from './appFlow.test-support';

let stop: () => void;
beforeAll(async () => {
  stop = initAppearance();
  await bootApp();
});
afterAll(() => {
  closeApp();
  stop();
});

it('keeps the active chat, draft, scroll node and focus while switching a single backdrop', async () => {
  const log = screen.getByRole('log');
  const input = screen.getByRole('textbox', { name: /メッセージ/ });
  fireEvent.change(input, { target: { value: 'background draft' } });
  input.focus();
  log.scrollTop = 123;
  for (const background of [
    { kind: 'generated', presetId: 'tile-turtle' },
    { kind: 'image', assetId: 'dawn' },
    { kind: 'image', assetId: 'night' },
    { kind: 'scene', sceneId: 'aurora' },
    { kind: 'none' },
    null,
  ] as const) {
    act(() => setBackground(background));
    await advance(0);
    expect(screen.getByRole('log')).toBe(log);
    expect(screen.getByRole('textbox', { name: /メッセージ/ })).toBe(input);
    expect((input as HTMLTextAreaElement).value).toBe('background draft');
    expect(document.activeElement).toBe(input);
    expect(log.scrollTop).toBe(123);
    expect(document.querySelectorAll('[data-asset], [data-scene], [data-generated]').length).toBe(
      background && background.kind !== 'none' ? 1 : 0,
    );
  }
});
