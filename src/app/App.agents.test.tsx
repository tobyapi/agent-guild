// @vitest-environment jsdom
// 画面の振る舞い（エージェントの作成）: 名前の検証で作成が止まることと、作成するとサイドバーに出ること。
// アプリ全体をモックのバックエンドで動かす。テストは同じ起動の続きとして順に動く（appFlow.test-support.tsx）。
import { fireEvent, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { advance, bootApp, closeApp, openDialog } from './appFlow.test-support';

beforeAll(bootApp);
afterAll(closeApp);

const sidebarText = () => screen.getByRole('navigation', { name: 'チャンネルとエージェント' }).textContent ?? '';
const presetAvatar = 'data:image/webp;base64,UklGRg==';
const nameField = () => within(openDialog()).getByLabelText<HTMLInputElement>('名前');
/** 名前の欄に出ているエラーの文面（出ていなければ空） */
const nameError = () => openDialog().querySelector(`[id="${nameField().id}-error"]`)?.textContent ?? '';

/** 名前を入れて「作成」を押す */
async function submitName(name: string): Promise<void> {
  fireEvent.change(nameField(), { target: { value: name } });
  fireEvent.click(within(openDialog()).getByRole('button', { name: '作成' }));
  await advance(1000);
}

it('名前が空か、ほかのエージェントと同じなら、作成せずに名前の欄で知らせる', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'エージェントを追加' }));
  await advance(500);
  expect(within(openDialog()).getByRole('heading', { name: '新しいエージェント' })).toBeTruthy();

  await submitName('');
  expect(nameField().getAttribute('aria-invalid')).toBe('true');
  expect(nameError()).not.toBe('');

  await submitName('ハル');
  expect(nameField().getAttribute('aria-invalid')).toBe('true');
  expect(nameError()).not.toBe('');
  expect(within(openDialog()).getByRole('heading', { name: '新しいエージェント' })).toBeTruthy();
});

it('キャラ図鑑から全15種の顔を読み込み、選んだ顔をアバターにする', async () => {
  const fetchImage = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(new Response('image', { headers: { 'content-type': 'image/webp' } })));
  vi.stubGlobal('fetch', fetchImage);
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 900, height: 1600, close: vi.fn() }));
  const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(presetAvatar);
  try {
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'キャラ図鑑' }));
    await advance(100);
    const gallery = within(screen.getByRole('dialog', { name: 'キャラクターアイコン' }));
    expect(gallery.getAllByRole('listitem')).toHaveLength(15);
    expect(new Set(fetchImage.mock.calls.map(([url]) => url)).size).toBe(15);
    fireEvent.click(gallery.getByRole('button', { name: 'JEV' }));
    expect(screen.queryByRole('dialog', { name: 'キャラクターアイコン' })).toBeNull();
    expect(within(openDialog()).getByLabelText('アバター').getAttribute('placeholder')).toBe('画像');
  } finally {
    encode.mockRestore();
    canvas.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('Ollama のモデルと選んだアバターを保存し、サイドバーに出す', async () => {
  expect(sidebarText()).not.toContain('ミナ');
  fireEvent.change(within(openDialog()).getByRole('combobox', { name: 'バックエンド' }), {
    target: { value: 'ollama' },
  });
  const modelField = within(openDialog()).getByRole<HTMLSelectElement>('combobox', { name: 'モデル' });
  expect(Array.from(modelField.options, (option) => option.value)).toEqual(['', 'deepseek-r1:8b', 'gemma4:26b']);
  fireEvent.change(modelField, { target: { value: 'gemma4:26b' } });
  expect(within(openDialog()).getByText('画像と文章に対応')).toBeTruthy();
  await submitName('ミナ');
  expect(sidebarText()).toContain('ミナ');
  const sidebar = screen.getByRole('navigation', { name: 'チャンネルとエージェント' });
  expect(sidebar.querySelector(`img[src="${presetAvatar}"]`)).toBeTruthy();
  expect(nameField().hasAttribute('aria-invalid')).toBe(false);
  expect(within(openDialog()).getByRole<HTMLSelectElement>('combobox', { name: 'モデル' }).value).toBe('gemma4:26b');
});
