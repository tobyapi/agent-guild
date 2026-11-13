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
  fireEvent.click(within(openDialog()).getByRole('tab', { name: 'AI と権限' }));
  fireEvent.change(within(openDialog()).getByRole('combobox', { name: 'バックエンド' }), {
    target: { value: 'ollama' },
  });
  const modelField = within(openDialog()).getByRole<HTMLSelectElement>('combobox', { name: 'モデル' });
  expect(Array.from(modelField.options, (option) => option.value)).toEqual(['', 'deepseek-r1:8b', 'gemma4:26b']);
  fireEvent.change(modelField, { target: { value: 'gemma4:26b' } });
  expect(within(openDialog()).getByText('画像と文章に対応 · JSON 操作（試作）')).toBeTruthy();
  expect(enabledPermissions()).toEqual([]);
  fireEvent.click(within(openDialog()).getByRole('switch', { name: '道具の利用を有効にする' }));
  expect(enabledPermissions()).toContain('スキルを使う');
  await submitName('ミナ');
  expect(sidebarText()).toContain('ミナ');
  fireEvent.click(within(openDialog()).getByRole('tab', { name: 'AI と権限' }));
  const sidebar = screen.getByRole('navigation', { name: 'チャンネルとエージェント' });
  expect(sidebar.querySelector(`img[src="${presetAvatar}"]`)).toBeTruthy();
  expect(nameField().hasAttribute('aria-invalid')).toBe(false);
  expect(
    within(openDialog()).getByRole('switch', { name: '道具の利用を有効にする' }).getAttribute('aria-checked'),
  ).toBe('true');
  expect(enabledPermissions()).toContain('スキルを使う');
  expect(within(openDialog()).getByRole<HTMLSelectElement>('combobox', { name: 'モデル' }).value).toBe('gemma4:26b');
});

it('keeps the auto-selected basics tab after the validation error is fixed', async () => {
  fireEvent.click(screen.getByRole('button', { name: '作業者を作成' }));
  await advance(500);
  const dialog = within(openDialog());
  const tabs = dialog.getAllByRole('tab');
  fireEvent.click(tabs[3]!);
  fireEvent.change(nameField(), { target: { value: '' } });
  const form = openDialog().querySelector('form');
  if (!form) throw new Error('Agent editor form was not found');
  fireEvent.submit(form);
  await advance(100);

  expect(dialog.getAllByRole('tab')[0]?.getAttribute('aria-selected')).toBe('true');
  fireEvent.change(nameField(), { target: { value: 'Tab persistence test' } });
  expect(dialog.getAllByRole('tab')[0]?.getAttribute('aria-selected')).toBe('true');
});

const permissions = [
  'Web 検索',
  'Web ページを読む',
  'ファイルを読む',
  'ファイルを書く',
  '作業フォルダの外にも書く',
  'コマンドを実行',
  'スキルを使う',
];
const grantedPermissions = () => {
  const list = within(openDialog()).getByRole('list', { name: '役割で決まる権限', hidden: true });
  return within(list)
    .getAllByRole('listitem', { hidden: true })
    .filter((item) => item.hasAttribute('data-granted'))
    .map((item) => item.firstElementChild?.textContent);
};
const enabledPermissions = () => {
  const list = within(openDialog()).getByRole('list', { name: '役割で決まる権限', hidden: true });
  return within(list)
    .getAllByRole('listitem', { hidden: true })
    .filter((item) => item.querySelector('[data-allowed]'))
    .map((item) => item.firstElementChild?.textContent);
};

it('役割で権限が固定され、バックエンドを変えても個別スイッチや依存エラーを出さない', async () => {
  fireEvent(openDialog(), new Event('cancel', { cancelable: true }));
  fireEvent.click(screen.getByRole('button', { name: '作業者を作成' }));
  expect(enabledPermissions()).toEqual(permissions);
  for (const name of permissions) expect(within(openDialog()).queryByRole('switch', { name })).toBeNull();

  const workspaceOnly = ['ファイルを読む', 'ファイルを書く', 'コマンドを実行', 'スキルを使う'];
  for (const name of [/^マネージャー/, /^専門家/]) {
    fireEvent.click(within(openDialog()).getByRole('radio', { name }));
    expect(enabledPermissions()).toEqual(['ファイルを読む', '作業フォルダの外も読む', ...workspaceOnly.slice(1)]);
  }
  fireEvent.click(within(openDialog()).getByRole('tab', { name: 'AI と権限' }));
  fireEvent.change(within(openDialog()).getByRole('combobox', { name: 'バックエンド' }), {
    target: { value: 'claude' },
  });
  expect(enabledPermissions()).toEqual(['ファイルを読む', '作業フォルダの外も読む', 'ファイルを書く', 'スキルを使う']);
  expect(within(openDialog()).getByText(/Claudeでは、このうち次の操作を使いません/)).toBeTruthy();
  // 権限（役割で決まる）はバックエンドを変えても同じ。変わるのは、その AI で使わない操作だけ
  expect(grantedPermissions()).toEqual(['ファイルを読む', '作業フォルダの外も読む', ...workspaceOnly.slice(1)]);
  fireEvent.change(within(openDialog()).getByPlaceholderText('タグを追加'), { target: { value: '作業者、' } });
  expect(enabledPermissions()).toEqual(['ファイルを読む', '作業フォルダの外も読む', 'ファイルを書く', 'スキルを使う']);
  await submitName('コハク');
  expect(within(openDialog()).getByRole('heading', { name: 'コハク を編集' })).toBeTruthy();
  expect(enabledPermissions()).toEqual(['ファイルを読む', '作業フォルダの外も読む', 'ファイルを書く', 'スキルを使う']);
  fireEvent.click(within(openDialog()).getByRole('radio', { name: /^作業者/ }));
  expect(enabledPermissions()).toEqual(permissions);
  fireEvent.click(within(openDialog()).getByRole('button', { name: '保存' }));
  await advance(1000);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('役割は4つで、発想役は呼ばれたときだけ答える設定で作成・保存できる', async () => {
  fireEvent.click(screen.getByRole('button', { name: 'エージェントを追加' }));
  const roles = within(openDialog()).getByRole('radiogroup', { name: 'どんな役割を任せますか' });
  const cards = within(roles).getAllByRole('radio');
  expect(cards.map((card) => card.querySelector('b')?.textContent)).toEqual([
    '作業者',
    '発想役',
    '専門家',
    'マネージャー',
  ]);
  fireEvent.click(within(roles).getByRole('radio', { name: /^発想役/ }));
  fireEvent.click(within(openDialog()).getByRole('tab', { name: '振る舞い' }));
  expect(within(openDialog()).getByRole<HTMLInputElement>('radio', { name: /^答えない/ }).checked).toBe(true);
  expect(within(openDialog()).getByRole('switch', { name: '相談相手になる' }).getAttribute('aria-checked')).toBe(
    'true',
  );
  expect(within(openDialog()).getByRole('switch', { name: 'タスクを割り振れる' }).getAttribute('aria-checked')).toBe(
    'false',
  );
  fireEvent.click(within(openDialog()).getByRole('tab', { name: '基本' }));
  fireEvent.change(within(openDialog()).getByRole('combobox', { name: /^人格の例/ }), {
    target: { value: 'idea-maker' },
  });
  expect(nameField().value).toBe('ヒラメ');
  await submitName('ヒラメ');
  expect(within(openDialog()).getByRole('heading', { name: 'ヒラメ を編集' })).toBeTruthy();
  expect(
    within(openDialog())
      .getByRole('radio', { name: /^発想役/ })
      .getAttribute('aria-checked'),
  ).toBe('true');
  expect(screen.getByRole('button', { name: '発想役を作成' })).toBeTruthy();
  expect(enabledPermissions()).toEqual(['ファイルを読む', 'ファイルを書く', 'コマンドを実行', 'スキルを使う']);
});
