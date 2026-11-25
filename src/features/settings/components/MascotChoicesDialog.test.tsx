// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import mascot from '../../../../contracts/ipc/mascot-images.json';
import { settingsApi } from '../api';
import { deleteGeneratedMascot, setMascotEnabled, setMascotSource } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { LIBRARY_KEY, type ThemeLibrary } from '../themeLibrary';
import { MascotChoicesDialog } from './MascotChoicesDialog';
import { MascotControls } from './MascotControls';

vi.mock('@/features/agents', () => ({ useActiveAgents: () => [], AvatarPresetPicker: () => null }));
vi.mock('@/features/runtime', () => ({ useBackends: () => [] }));

const id = mascot.delete.args.id;
const label = t('mascotGeneratedImage', { number: 1 });
const storedMascot = () => (JSON.parse(localStorage.getItem(LIBRARY_KEY)!) as ThemeLibrary).mascot;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  localStorage.clear();
  setMascotEnabled(true);
  setMascotSource({ kind: 'default' });
  vi.spyOn(settingsApi, 'listMascots').mockResolvedValue([id]);
  vi.spyOn(settingsApi, 'getMascot').mockResolvedValue(mascot.get.result);
  vi.spyOn(settingsApi, 'deleteMascot').mockResolvedValue(mascot.delete.result);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openConfirmation(imageLabel = label) {
  fireEvent.click(await screen.findByRole('button', { name: t('backgroundDeleteLabel', { label: imageLabel }) }));
  return within(screen.getByRole('dialog', { name: t('mascotDelete') }));
}

it('waits for confirmation and removes only the chosen image', async () => {
  const other = '12345678-1234-1234-1234-123456789abd';
  vi.mocked(settingsApi.listMascots).mockResolvedValue([id, other]);
  setMascotSource({ kind: 'generated', id: other });
  render(<MascotChoicesDialog onClose={vi.fn()} />);

  const confirmation = await openConfirmation();
  expect(confirmation.getByText(t('mascotDeleteConfirm', { label }))).toBeTruthy();
  expect(settingsApi.deleteMascot).not.toHaveBeenCalled();
  fireEvent.click(confirmation.getByRole('button', { name: t('backgroundDelete') }));

  await waitFor(() => expect(settingsApi.deleteMascot).toHaveBeenCalledExactlyOnceWith(id));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: t('mascotDelete') })).toBeNull());
  expect(screen.getByRole('button', { name: label, pressed: true })).toBeTruthy();
  expect(screen.queryByRole('button', { name: t('mascotGeneratedImage', { number: 2 }) })).toBeNull();
  expect(storedMascot()).toMatchObject({ enabled: true, source: { kind: 'generated', id: other } });
});

it('leaves the selection and file alone when cancelled', async () => {
  setMascotSource({ kind: 'generated', id });
  render(<MascotChoicesDialog onClose={vi.fn()} />);
  await openConfirmation();
  const dialog = screen.getByRole('dialog', { name: t('mascotDelete') });
  fireEvent.click(dialog.querySelector('[data-autofocus]')!);
  expect(screen.queryByRole('dialog', { name: t('mascotDelete') })).toBeNull();
  expect(settingsApi.deleteMascot).not.toHaveBeenCalled();
  expect(storedMascot()).toMatchObject({ enabled: true, source: { kind: 'generated', id } });
});

it('keeps the picker open when Escape cancels confirmation', async () => {
  const closePicker = vi.fn();
  render(<MascotChoicesDialog onClose={closePicker} />);
  await openConfirmation();
  fireEvent(screen.getByRole('dialog', { name: t('mascotDelete') }), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog', { name: t('mascotDelete') })).toBeNull();
  expect(screen.getByRole('dialog', { name: t('mascotChoose') })).toBeTruthy();
  expect(closePicker).not.toHaveBeenCalled();
  expect(settingsApi.deleteMascot).not.toHaveBeenCalled();
});

it.each(['existing', 'already missing'])('clears the selected %s image before removal', async (file) => {
  setMascotSource({ kind: 'generated', id });
  if (file === 'already missing') {
    // The desktop command returns success for a missing file.
    vi.mocked(settingsApi.listMascots).mockResolvedValue([]);
    vi.mocked(settingsApi.getMascot).mockRejectedValue({ code: 'not_found' });
  }
  vi.mocked(settingsApi.deleteMascot).mockImplementation(() => {
    expect(storedMascot()).toMatchObject({ enabled: false, source: { kind: 'default' } });
    return Promise.resolve(null);
  });
  render(<MascotControls scheme="dark" />);
  fireEvent.click(screen.getByRole('button', { name: t('mascotChoose') }));
  const imageLabel = file === 'already missing' ? t('mascotMissingImage') : label;
  const confirmation = await openConfirmation(imageLabel);
  fireEvent.click(confirmation.getByRole('button', { name: t('backgroundDelete') }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: t('backgroundDeleteLabel', { label: imageLabel }) })).toBeNull(),
  );
  expect(settingsApi.deleteMascot).toHaveBeenCalledExactlyOnceWith(id);
  expect(screen.getByRole('dialog', { name: t('mascotChoose') })).toBeTruthy();
  expect(screen.getByRole('switch', { name: t('mascotShow'), checked: false })).toBeTruthy();
  expect(storedMascot()).toMatchObject({ enabled: false, source: { kind: 'default' } });
});

it('offers deletion when mascot display is off', async () => {
  setMascotEnabled(false);
  render(<MascotControls scheme="dark" />);
  fireEvent.click(screen.getByRole('button', { name: t('mascotChoose') }));
  const confirmation = await openConfirmation();
  fireEvent.click(confirmation.getByRole('button', { name: t('backgroundDelete') }));
  await waitFor(() => expect(screen.queryByRole('button', { name: label })).toBeNull());
  expect(settingsApi.deleteMascot).toHaveBeenCalledExactlyOnceWith(id);
  expect(storedMascot().enabled).toBe(false);
});

it('rejects a path before invoking the desktop command or changing the selection', async () => {
  setMascotSource({ kind: 'generated', id });
  await expect(deleteGeneratedMascot('../outside')).rejects.toThrow('Invalid mascot image ID');
  expect(settingsApi.deleteMascot).not.toHaveBeenCalled();
  expect(storedMascot()).toMatchObject({ enabled: true, source: { kind: 'generated', id } });
});

it('restores the selection and shows an error if the desktop command fails', async () => {
  setMascotSource({ kind: 'generated', id });
  vi.mocked(settingsApi.deleteMascot).mockRejectedValue({ code: 'storage' });
  render(<MascotControls scheme="dark" />);
  fireEvent.click(screen.getByRole('button', { name: t('mascotChoose') }));
  const confirmation = await openConfirmation();
  fireEvent.click(confirmation.getByRole('button', { name: t('backgroundDelete') }));
  expect((await confirmation.findByRole('alert')).textContent).toBe(t('mascotDeleteFailed'));
  expect(storedMascot()).toMatchObject({ enabled: true, source: { kind: 'generated', id } });
});

it('leaves the file in place when persistence fails', async () => {
  setMascotSource({ kind: 'generated', id });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage full');
  });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(deleteGeneratedMascot(id)).rejects.toThrow('Cannot save mascot settings');
  expect(warn).toHaveBeenCalledOnce();
  expect(settingsApi.deleteMascot).not.toHaveBeenCalled();
  expect(storedMascot()).toMatchObject({ enabled: true, source: { kind: 'generated', id } });
});

it('returns to the preceding page after deleting the last image on a page', async () => {
  const ids = Array.from({ length: 7 }, (_, index) => `12345678-1234-1234-1234-123456789ab${index}`);
  vi.mocked(settingsApi.listMascots).mockResolvedValue(ids);
  render(<MascotChoicesDialog onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: t('mascotNext') }));
  const confirmation = await openConfirmation(t('mascotGeneratedImage', { number: 7 }));
  fireEvent.click(confirmation.getByRole('button', { name: t('backgroundDelete') }));
  expect(await screen.findByRole('button', { name: label })).toBeTruthy();
  expect(settingsApi.deleteMascot).toHaveBeenCalledExactlyOnceWith(ids[6]);
});
