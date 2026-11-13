// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { closeSettings, openSettings } from '../store';
import { SettingsDialog } from './SettingsDialog';

const scrollIntoView = vi.fn();

vi.mock('@/features/agents', () => ({ useActiveAgents: () => [] }));
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
vi.mock('./LanguageSection', () => ({ LanguageSection: () => <div>language form</div> }));
vi.mock('./StorageSection', () => ({ StorageSection: () => <div>storage form</div> }));

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
    ['AI', ['バックエンド', 'スキルのフォルダ']],
    ['アプリ', ['データの保存先', 'アプリの更新']],
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
