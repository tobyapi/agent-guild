// @vitest-environment jsdom
// 画面の振る舞い（アイコンの枠）: 設定のプロフィールで枠を選んで保存するとサイドバーの自分のアイコンに付き、
// 枠の生成を申告するバックエンド（モックの codex）が使える状態なら AI に枠を画像で生成させられ、
// 生成した枠は選択肢に足されて選ばれ（絵は get_frame_image で取って重ねる）、消すと枠なしに戻ること。
// アプリ全体をモックのバックエンドで動かす（appFlow.test-support.tsx）。
import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { invoke } from '@/shared/api';
import { advance, bootApp, closeApp, openDialog } from './appFlow.test-support';

beforeAll(bootApp);
afterAll(closeApp);

const card = () => screen.getByRole('button', { name: 'ユーザー（設定を開く）' });
const framedCard = () => card().querySelector('[data-framed]');
const profileForm = () => {
  const form = within(openDialog()).getByRole('radiogroup', { name: 'アイコンの枠' }).closest('form');
  if (!form) throw new Error('プロフィールの欄がありません');
  return form;
};
const topDialog = () => {
  const dialogs = document.querySelectorAll<HTMLElement>('dialog[open]');
  const top = dialogs[dialogs.length - 1];
  if (!top) throw new Error('開いているダイアログがありません');
  return top;
};

it('はじめは枠なしで、選択肢は「なし」・内蔵の8つの順', async () => {
  expect(framedCard()).toBeNull();
  fireEvent.click(card());
  await advance(500);
  const radios = within(within(profileForm()).getByRole('radiogroup', { name: 'アイコンの枠' })).getAllByRole('radio');
  expect(radios).toHaveLength(9);
  expect(radios[0]?.getAttribute('aria-label')).toBe('なし');
  expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
  expect(radios[5]?.getAttribute('aria-label')).toBe('蛾と角灯');
});

it('枠を選んで保存すると、サイドバーの自分のアイコンに付く', async () => {
  const form = profileForm();
  fireEvent.click(within(form).getByRole('radio', { name: '蛾と角灯' }));
  expect(framedCard()).toBeNull();
  fireEvent.click(within(form).getByRole('button', { name: '保存' }));
  await advance(500);
  expect(framedCard()).not.toBeNull();
});

it('矢印キーで隣の枠へ移る', () => {
  const moth = within(profileForm()).getByRole('radio', { name: '蛾と角灯' });
  fireEvent.keyDown(moth, { key: 'ArrowRight' });
  expect(within(profileForm()).getByRole('radio', { name: '風見の鴉' }).getAttribute('aria-checked')).toBe('true');
});

it('枠を描けるバックエンドが使える状態でなければ、生成のダイアログで知らせて生成できない', async () => {
  fireEvent.click(within(profileForm()).getByRole('button', { name: '生成する…' }));
  await advance(100);
  const dialog = topDialog();
  expect(within(dialog).getByText(/枠を生成できるバックエンドが、いま使える状態ではありません/)).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: '生成する' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
  await advance(100);
});

it('題材を書いて生成すると、オリジナルの枠が足されて選ばれる', async () => {
  // モックの再確認で、ログイン待ちの codex（枠の生成を申告する）を使える状態にする
  const refreshing = invoke('refresh_backends');
  await advance(1000);
  await refreshing;
  fireEvent.click(within(profileForm()).getByRole('button', { name: '生成する…' }));
  await advance(100);
  const dialog = topDialog();
  fireEvent.click(within(dialog).getByRole('button', { name: '生成する' }));
  await advance(100);
  expect(within(dialog).getByText('どんな枠にするかを書いてください')).toBeTruthy();

  // 描くのは選んだバックエンドのアカウントで、時間がかかることを伝える
  expect(within(dialog).getByText(/「Codex」にログインしているアカウントで画像を生成します/)).toBeTruthy();
  fireEvent.change(within(dialog).getByLabelText('題材'), { target: { value: '月夜の薔薇と鎖' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '生成する' }));
  await advance(100);
  expect(within(dialog).getByRole('status').textContent).toContain('数分');
  await advance(2000);
  const custom = within(profileForm()).getByRole('radio', { name: '月夜の薔薇と鎖' });
  expect(custom.getAttribute('aria-checked')).toBe('true');
  // 画像の枠の絵は取り終わると見本に重なる（取っている間は aria-busy）
  await advance(100);
  expect(custom.getAttribute('aria-busy')).toBeNull();
  expect(custom.querySelector('img[src^="data:image/png;base64,"]')).not.toBeNull();
});

it('生成した枠は消せて、選んでいた枠は「なし」に戻る', async () => {
  fireEvent.click(within(profileForm()).getByRole('button', { name: '「月夜の薔薇と鎖」を削除' }));
  await advance(100);
  fireEvent.click(within(topDialog()).getByRole('button', { name: '削除' }));
  await advance(500);
  expect(within(profileForm()).queryByRole('radio', { name: '月夜の薔薇と鎖' })).toBeNull();
  expect(within(profileForm()).getByRole('radio', { name: 'なし' }).getAttribute('aria-checked')).toBe('true');
});
