// @vitest-environment jsdom
// 画面の振る舞い（ギルドの名前と紋）: 設定の「ギルド」で保存すると、サイドバーの紋の行が変わること。
// アプリ全体をモックのバックエンドで動かす（appFlow.test-support.tsx）。
import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, bootApp, closeApp, openDialog } from './appFlow.test-support';

beforeAll(bootApp);
afterAll(closeApp);

const brand = () =>
  screen.getByRole('complementary', { name: 'サイドバー' }).querySelector('svg[data-shape]')?.parentElement;
const guildForm = () => within(openDialog()).getByRole('radiogroup', { name: '紋の形' }).closest('form');

it('名前が空ならアプリ名と菱の紋を出す', () => {
  expect(brand()?.textContent).toBe('AIギルド');
  expect(brand()?.querySelector('svg')?.dataset.shape).toBe('diamond');
});

it('設定でギルド名と紋を選んで保存すると、サイドバーの紋の行に出る', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'ユーザー（設定を開く）' }));
  await advance(500);
  const form = guildForm();
  if (!form) throw new Error('ギルドの欄がありません');
  fireEvent.change(within(form).getByLabelText('ギルド名'), { target: { value: '  灯の団 ' } });
  fireEvent.click(within(form).getByRole('radio', { name: '星' }));
  fireEvent.click(within(form).getByRole('radio', { name: '若竹' }));
  expect(brand()?.textContent).toBe('AIギルド');

  fireEvent.click(within(form).getByRole('button', { name: '保存' }));
  await advance(500);
  expect(brand()?.textContent).toBe('灯の団');
  expect(brand()?.querySelector('svg')?.dataset.shape).toBe('star');
});

it('長すぎる名前は保存せずに名前の欄で知らせる', async () => {
  const form = guildForm();
  if (!form) throw new Error('ギルドの欄がありません');
  const field = within(form).getByLabelText<HTMLInputElement>('ギルド名');
  fireEvent.change(field, { target: { value: 'あ'.repeat(33) } });
  fireEvent.click(within(form).getByRole('button', { name: '保存' }));
  await advance(500);
  expect(field.getAttribute('aria-invalid')).toBe('true');
  expect(brand()?.textContent).toBe('灯の団');
});
