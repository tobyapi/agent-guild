// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, bootApp, closeApp, openDialog } from './appFlow.test-support';

beforeAll(bootApp);
afterAll(closeApp);

it('keeps named avatars and the add action available in the compact rail', () => {
  const panel = screen.getByRole('complementary', { name: 'チャンネルのメンバー' });
  const me = panel.querySelector('li [data-human]');
  expect(me?.closest('li')?.getAttribute('aria-label')).toContain('あなた');
  expect(me?.closest('li')?.getAttribute('title')).toContain('あなた');
  const avatars = panel.querySelectorAll<HTMLButtonElement>('button[class*=compactAvatar]');
  expect(avatars.length).toBeGreaterThan(0);
  for (const avatar of avatars) {
    expect(avatar.getAttribute('aria-label')).toMatch(/.+ を編集/);
    expect(avatar.title.length).toBeGreaterThan(0);
    expect(avatar.querySelector('[aria-hidden="true"]')).not.toBeNull();
  }
  const add = panel.querySelector<HTMLButtonElement>('button[class*=compactAdd]');
  expect(add?.getAttribute('aria-label')).toBe('メンバーを追加');
  expect(add?.title).toBe('メンバーを追加');
});

it('opens the existing editor from a compact avatar', async () => {
  const avatar = document.querySelector<HTMLButtonElement>('button[class*=compactAvatar]')!;
  fireEvent.click(avatar);
  await advance(0);
  expect(within(openDialog()).getByRole('textbox', { name: /名前/ })).toBeTruthy();
  fireEvent.click(within(openDialog()).getAllByRole('button', { name: '閉じる' })[0]!);
  await advance(0);
});

it('opens the existing member picker from the compact plus button', async () => {
  fireEvent.click(document.querySelector<HTMLButtonElement>('button[class*=compactAdd]')!);
  await advance(0);
  expect(openDialog().textContent).toContain('メンバー');
  fireEvent.click(within(openDialog()).getAllByRole('button', { name: '閉じる' })[0]!);
  await advance(0);
});

it('removes the entire member rail when the existing toggle is closed', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'メンバー', pressed: true }));
  await advance(0);
  expect(screen.queryByRole('complementary', { name: 'チャンネルのメンバー' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'メンバー', pressed: false }));
  await advance(0);
  expect(screen.getByRole('complementary', { name: 'チャンネルのメンバー' })).toBeTruthy();
});
