// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DEFAULT_SOUND_PREFERENCES } from '../model/preferences';
import { setSoundPreferences, useSoundStore } from '../store';
import { SoundSection } from './SoundSection';

afterEach(() => {
  cleanup();
  setSoundPreferences(DEFAULT_SOUND_PREFERENCES);
});

it('音を選ぶと設定に入り、なしのときは試聴を出さない（音が出せない環境でも試聴は失敗しない）', () => {
  render(<SoundSection />);
  expect(screen.getByLabelText('自分宛ての音')).toHaveProperty('value', 'chime');
  expect(screen.getAllByRole('button', { name: /試聴/ })).toHaveLength(1);

  fireEvent.change(screen.getByLabelText('返信の音'), { target: { value: 'wood' } });
  expect(useSoundStore.getState().preferences.message).toBe('wood');
  expect(screen.getAllByRole('button', { name: /試聴/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '木を試聴' }));

  fireEvent.change(screen.getByLabelText('音量'), { target: { value: '30' } });
  expect(useSoundStore.getState().preferences.volume).toBeCloseTo(0.3);
  fireEvent.click(screen.getByRole('switch'));
  expect(useSoundStore.getState().preferences.onlyWhenUnfocused).toBe(false);
});
