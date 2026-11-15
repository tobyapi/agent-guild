// @vitest-environment jsdom
// shared だけの画面でチャンネルを保存・再編集する。
import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, bootApp, closeApp, openDialog } from './appFlow.test-support';

beforeAll(bootApp);
afterAll(closeApp);

it('範囲の選択なしで話題を保存し、開き直しても復元される', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'チャンネルを編集' }));
  const form = within(openDialog());
  expect(form.queryByLabelText('ファイルの範囲')).toBeNull();
  expect(form.queryByRole('textbox', { name: '作業フォルダ' })).toBeNull();
  fireEvent.change(form.getByRole('textbox', { name: /^話題/ }), { target: { value: '共通の作業場所で企画する' } });
  fireEvent.click(form.getByRole('button', { name: '保存' }));
  await advance(1000);
  expect(document.querySelector('dialog[open]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'チャンネルを編集' }));
  const reopened = within(openDialog());
  expect(reopened.getByRole<HTMLInputElement>('textbox', { name: /^話題/ }).value).toBe('共通の作業場所で企画する');
  expect(reopened.queryByLabelText('ファイルの範囲')).toBeNull();
  fireEvent.click(reopened.getByRole('button', { name: 'キャンセル' }));
});
