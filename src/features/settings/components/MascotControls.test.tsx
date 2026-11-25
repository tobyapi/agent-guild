// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { backendInfo } from '@/shared/lib/backends.test-support';
import { DEFAULT_MASCOT_LAYOUT } from '@/shared/theme/mascot';
import { settingsApi } from '../api';
import { setMascotEnabled, setMascotSource } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { LIBRARY_KEY, type ThemeLibrary } from '../themeLibrary';
import { MascotControls } from './MascotControls';

const runtime = vi.hoisted(() => ({ backends: [] as ReturnType<typeof backendInfo>[] }));
vi.mock('@/features/runtime', () => ({ useBackends: () => runtime.backends }));
vi.mock('@/features/agents', () => ({
  useActiveAgents: () => [{ id: 'agent-sample', name: 'Sample agent', avatar: '🐈' }],
  AvatarPresetPicker: ({ onChoose }: { onChoose: (value: string) => void }) => (
    <button onClick={() => onChoose('data:image/webp;base64,cGl4ZWw=')}>Test preset</button>
  ),
}));

const id = '12345678-1234-1234-1234-123456789abc';
const image = 'data:image/png;base64,cGl4ZWw=';
const stored = () => JSON.parse(localStorage.getItem(LIBRARY_KEY)!) as ThemeLibrary;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  localStorage.clear();
  setMascotEnabled(true);
  setMascotSource({ kind: 'default' });
  runtime.backends = [];
  vi.spyOn(settingsApi, 'listMascots').mockResolvedValue([]);
  vi.spyOn(settingsApi, 'getMascot').mockResolvedValue(image);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('shows a disabled generation button and the reason without a ready backend', () => {
  runtime.backends = [backendInfo({ status: 'needs_auth', backgroundGeneration: true })];
  render(<MascotControls scheme="dark" />);
  const button = screen.getByRole<HTMLButtonElement>('button', { name: t('mascotGenerateTitle') });
  expect(button.disabled).toBe(true);
  expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(t('mascotNoReady'));
  expect(screen.getByRole('switch', { name: t('mascotShow'), checked: true })).toBeTruthy();
});

it('selects existing agent avatars and reuses the preset picker in Appearance', async () => {
  const { container } = render(<MascotControls scheme="dark" />);
  fireEvent.click(screen.getByRole('button', { name: t('mascotChoose') }));
  fireEvent.click(screen.getByRole('button', { name: 'Sample agent' }));
  const preview = container.querySelector('[data-preview][data-mascot-state]')!;
  expect(preview.textContent).toContain('🐈');
  expect(stored().mascot.source).toEqual({ kind: 'agent', id: 'agent-sample' });
  fireEvent.click(screen.getByRole('button', { name: 'Test preset' }));
  expect(preview.querySelector('img')?.getAttribute('src')).toBe('data:image/webp;base64,cGl4ZWw=');
  expect(stored().mascot.source.kind).toBe('preset');
  await waitFor(() => expect(settingsApi.listMascots).toHaveBeenCalledOnce());
});

it('exposes independent position and size controls and resets both items', () => {
  render(<MascotControls scheme="dark" />);
  const mascot = within(screen.getByRole('group', { name: t('backgroundMascot') }));
  const card = within(screen.getByRole('group', { name: t('mascotCard') }));
  const position = mascot.getByRole('slider', { name: t('mascotHorizontal') });
  const size = card.getByRole('slider', { name: t('mascotSize') });
  const preview = screen.getByRole('region', { name: t('mascotChannel') }).closest('[data-preview]')!;
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  fireEvent.change(position, { target: { value: '30' } });
  fireEvent.change(position, { target: { value: '24' } });
  expect((preview.firstElementChild as HTMLElement).style.getPropertyValue('--item-x')).toBe('0.24');
  expect(writes).not.toHaveBeenCalled();
  fireEvent.pointerUp(position);
  fireEvent.blur(position);
  expect(writes).toHaveBeenCalledOnce();
  fireEvent.change(size, { target: { value: '120' } });
  expect(writes).toHaveBeenCalledOnce();
  fireEvent.keyUp(size, { key: 'ArrowRight' });
  expect(writes).toHaveBeenCalledTimes(2);
  expect(stored().mascot.layout).toMatchObject({ mascot: { x: 24 }, card: { size: 120 } });
  fireEvent.click(screen.getByRole('button', { name: t('mascotResetLayout') }));
  expect(stored().mascot.layout).toEqual(DEFAULT_MASCOT_LAYOUT);
});

function startGeneration() {
  runtime.backends = [backendInfo({ id: 'artist', backgroundGeneration: true })];
  render(<MascotControls scheme="light" />);
  fireEvent.click(screen.getByRole('button', { name: t('mascotGenerateTitle') }));
  const subject = screen.getByLabelText(t('backgroundSubject'));
  fireEvent.change(subject, { target: { value: ' blue owl ' } });
  fireEvent.submit(subject.closest('form')!);
}

it('uses the mascot command, selects the saved image, and offers it again in the library', async () => {
  const generate = vi.spyOn(settingsApi, 'generateMascot').mockResolvedValue(id);
  vi.mocked(settingsApi.listMascots).mockResolvedValue([id]);
  startGeneration();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(generate).toHaveBeenCalledWith(expect.any(String), 'artist', 'blue owl');
  expect(stored()).toMatchObject({
    mascot: { enabled: true, source: { kind: 'generated', id } },
  });
  fireEvent.click(screen.getByRole('button', { name: t('mascotChoose') }));
  const saved = await screen.findByRole('button', { name: t('mascotGeneratedImage', { number: 1 }) });
  expect(saved.getAttribute('aria-pressed')).toBe('true');
});

it('surfaces a failed generation and uses the shared cancel request on retry', async () => {
  let finish!: (id: string) => void;
  const generate = vi
    .spyOn(settingsApi, 'generateMascot')
    .mockRejectedValueOnce(new Error('failed'))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const cancel = vi.spyOn(settingsApi, 'cancelBackgroundGeneration').mockResolvedValue(null);
  startGeneration();
  expect((await screen.findByRole('alert')).textContent).toBe(t('mascotGenerationFailed'));
  fireEvent.submit(screen.getByLabelText(t('backgroundSubject')).closest('form')!);
  fireEvent.click(screen.getByRole('button', { name: t('backgroundStop') }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(cancel).toHaveBeenCalledWith(generate.mock.calls[1]?.[0]);
  await act(() => {
    finish(id);
    return Promise.resolve();
  });
  expect(stored().mascot.source.kind).not.toBe('generated');
});
