// @vitest-environment jsdom
// The UI saves the chosen scope, retains it when reopened, and validates missing paths before saving.
import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { advance, bootApp, closeApp, openDialog } from './appFlow.test-support';

beforeAll(bootApp);
afterAll(closeApp);

it('作業フォルダを画面で保存し、開き直すと設定が復元される', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'チャンネルを編集' }));
  const form = within(openDialog());
  fireEvent.change(form.getByLabelText('ファイルの範囲'), { target: { value: 'folder' } });
  fireEvent.click(form.getByRole('button', { name: '保存' }));
  await advance(300);
  expect(form.getByText('作業フォルダの絶対パスを入力してください')).toBeTruthy();
  fireEvent.change(form.getByRole('textbox', { name: '作業フォルダ' }), { target: { value: '/tmp/guild-project' } });
  fireEvent.click(form.getByRole('button', { name: '保存' }));
  await advance(1000);
  fireEvent.click(screen.getByRole('button', { name: 'チャンネルを編集' }));
  const reopened = within(openDialog());
  expect(reopened.getByLabelText<HTMLSelectElement>('ファイルの範囲').value).toBe('folder');
  expect(reopened.getByRole<HTMLInputElement>('textbox', { name: '作業フォルダ' }).value).toBe('/tmp/guild-project');
  fireEvent.change(reopened.getByLabelText('ファイルの範囲'), { target: { value: 'shared' } });
  fireEvent.click(reopened.getByRole('button', { name: '保存' }));
  await advance(1000);
  fireEvent.click(screen.getByRole('button', { name: 'チャンネルを編集' }));
  expect(within(openDialog()).getByLabelText<HTMLSelectElement>('ファイルの範囲').value).toBe('shared');
});
