// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyLanguage } from '@/shared/i18n';
import { settingsApi } from '../api';
import { closeSettings, openSettings } from '../store';
import { SettingsDialog } from './SettingsDialog';

const scrollIntoView = vi.fn();

vi.mock('@/features/agents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/agents')>()),
  useActiveAgents: () => [],
}));
vi.mock('@/features/guild', () => ({
  GuildForm: () => <input aria-label="guild draft" />,
  guildSectionTitle: () => 'ギルド',
}));
vi.mock('@/features/profile', () => ({ ProfileForm: () => <div>profile form</div> }));
vi.mock('@/features/skills', () => ({ SkillLibrarySection: () => <div>skills form</div> }));
vi.mock('@/features/sounds', () => ({ SoundSection: () => <div>sound form</div>, soundSectionTitle: () => '通知' }));
vi.mock('@/features/update', () => ({ UpdateSection: () => <div>update form</div> }));
vi.mock('./AppearanceSection', () => ({ AppearanceSection: () => <div>appearance form</div> }));
vi.mock('./BackendsSection', () => ({ BackendsSection: () => <div>backends form</div> }));
vi.mock('./GlobalInstructionsSection', () => ({
  GlobalInstructionsSection: () => <div>shared instructions form</div>,
}));
vi.mock('./LanguageSection', () => ({ LanguageSection: () => <div>language form</div> }));
vi.mock('./RunLimitsSection', () => ({ RunLimitsSection: () => <div>run limits form</div> }));
vi.mock('./StorageSection', () => ({ StorageSection: () => <div>storage form</div> }));
vi.mock('./WorktreeHomeSection', () => ({ WorktreeHomeSection: () => <div>worktree home form</div> }));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  cleanup();
  closeSettings();
  applyLanguage('ja');
  vi.restoreAllMocks();
});

it('4グループを切り替え、表示する区画を絞り、入力途中の内容を保つ', () => {
  openSettings();
  render(<SettingsDialog />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  expect(screen.getByRole('tab', { selected: true }).textContent).toBe('ギルドとあなた');
  fireEvent.change(screen.getByLabelText('guild draft'), { target: { value: 'draft' } });
  for (const [name, headings] of [
    ['表示と通知', ['言語', '外観', '通知']],
    ['AI', ['実行の上限', '全エージェント共通の指示', 'バックエンド', 'スキルのフォルダ']],
    ['アプリ', ['データの保存先', '作業用フォルダの置き場', 'アプリの更新', 'ライセンス表記']],
  ] as const) {
    fireEvent.click(screen.getByRole('tab', { name }));
    const panel = screen.getByRole('tabpanel');
    expect(
      within(panel)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(headings);
    expect(screen.queryByRole('textbox', { name: 'guild draft' })).toBeNull();
  }
  fireEvent.click(screen.getByRole('tab', { name: 'ギルドとあなた' }));
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'guild draft' }).value).toBe('draft');
});

it('lists attribution and changes for all 15 characters with original and license links', () => {
  const openUrl = vi.spyOn(settingsApi, 'openUrl').mockResolvedValue(null);
  openSettings();
  render(<SettingsDialog />);
  fireEvent.click(screen.getByRole('tab', { name: 'アプリ' }));
  const notices = within(screen.getByRole('region', { name: 'ライセンス表記' }));
  expect(notices.getAllByRole('listitem')).toHaveLength(15);
  expect(notices.getAllByText(/全身画像の背景を除去/)).toHaveLength(14);
  expect(notices.getAllByText('作者 ZipZipPipe')).toHaveLength(14);
  const jev = within(notices.getByText('JEV').closest('li')!);
  expect(jev.getByText(/全身画像は加工なし/)).toBeTruthy();
  expect(jev.getByText(/利用条件の記載は見つかっていません。.*作者名の表示・商用利用不可/)).toBeTruthy();
  fireEvent.click(notices.getByRole('button', { name: 'AI 擬人化キャラクター図鑑' }));
  expect(openUrl).toHaveBeenLastCalledWith('https://genderswapai.com/ja/ai-gijinka');
  fireEvent.click(notices.getByRole('button', { name: 'JEV · 元の投稿' }));
  expect(openUrl).toHaveBeenLastCalledWith('https://www.bilibili.com/opus/1253808555541135367');
  fireEvent.click(notices.getByRole('button', { name: /^CC BY-NC-SA 4.0/ }));
  expect(openUrl).toHaveBeenLastCalledWith('https://creativecommons.org/licenses/by-nc-sa/4.0/');
});

it('shows the license notice in English and opens the English gallery', () => {
  const openUrl = vi.spyOn(settingsApi, 'openUrl').mockResolvedValue(null);
  applyLanguage('en');
  openSettings();
  render(<SettingsDialog />);
  fireEvent.click(screen.getByRole('tab', { name: 'App' }));
  const notices = within(screen.getByRole('region', { name: 'License notices' }));
  expect(notices.getByText(/MIT license. Commercial use is prohibited/)).toBeTruthy();
  expect(notices.getAllByText('By ZipZipPipe')).toHaveLength(14);
  expect(notices.getByText(/Full-body image unmodified/)).toBeTruthy();
  expect(notices.getByText(/No terms of use found\..*attribution required, no commercial use\./)).toBeTruthy();
  fireEvent.click(notices.getByRole('button', { name: 'AI Gijinka character gallery' }));
  expect(openUrl).toHaveBeenLastCalledWith('https://genderswapai.com/ai-gijinka');
});

it('矢印キー・Home・Endで選択とフォーカスが移る', () => {
  openSettings();
  render(<SettingsDialog />);
  for (const [key, name] of [
    ['ArrowDown', '表示と通知'],
    ['End', 'アプリ'],
    ['ArrowDown', 'ギルドとあなた'],
    ['ArrowUp', 'アプリ'],
    ['Home', 'ギルドとあなた'],
  ]) {
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe(name);
    expect(document.activeElement).toBe(screen.getByRole('tab', { selected: true }));
  }
});

it.each([
  ['skillLibrary', 'AI', 'スキルのフォルダ'],
  ['update', 'アプリ', 'アプリの更新'],
] as const)('%sを直接開くと対象グループと区画が表示される', (focus, group, heading) => {
  openSettings(focus);
  render(<SettingsDialog />);
  expect(screen.getByRole('tab', { selected: true }).textContent).toBe(group);
  expect(within(screen.getByRole('tabpanel')).getByRole('heading', { name: heading })).toBeTruthy();
  expect(scrollIntoView).toHaveBeenCalled();
  act(() => closeSettings());
  act(() => openSettings());
  expect(screen.getByRole('tab', { selected: true }).textContent).toBe('ギルドとあなた');
});

it('開いた状態で別の直接表示を求められた場合も切り替える', () => {
  openSettings();
  render(<SettingsDialog />);
  act(() => openSettings('update'));
  expect(screen.getByRole('tab', { selected: true }).textContent).toBe('アプリ');
});
