// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { setActivity } from '@/features/runtime';
import { setBackground, setMascotEnabled } from '@/features/settings';
import { ChannelMascot } from './ChannelMascot';

const channel = { id: 'here', name: 'Here', topic: '', icon: '', isLobby: false, memberIds: [], createdAt: 0 };
const other = { ...channel, id: 'elsewhere', name: 'Elsewhere' };

afterEach(() => {
  cleanup();
  setBackground({ kind: 'none' });
  setMascotEnabled(false);
  setActivity({ activities: [], queues: [] });
});

it('tracks working and pending jobs only for the open channel and follows independent mascot visibility', () => {
  setMascotEnabled(true);
  const view = render(<ChannelMascot channel={channel} />);
  const scene = () => view.container.querySelector('[data-mascot-state]');
  const counts = () =>
    within(screen.getByRole('region'))
      .getAllByRole('definition')
      .map((node) => node.textContent);
  expect(scene()?.getAttribute('data-mascot-state')).toBe('idle');
  expect(counts()).toEqual(['0', '0']);
  act(() =>
    setActivity({
      activities: [{ agentId: 'a', channelId: channel.id, detail: 'working' }],
      queues: [
        { channelId: channel.id, running: 1, pending: 2 },
        { channelId: other.id, running: 0, pending: 3 },
      ],
    }),
  );
  expect(scene()?.getAttribute('data-mascot-state')).toBe('working');
  expect(counts()).toEqual(['1', '2']);
  view.rerender(<ChannelMascot channel={other} />);
  expect(scene()?.getAttribute('data-mascot-state')).toBe('idle');
  expect(counts()).toEqual(['0', '3']);
  act(() => setBackground({ kind: 'image', assetId: '12345678-1234-1234-1234-123456789abc' }));
  expect(scene()).not.toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  act(() => {
    setMascotEnabled(false);
  });
  expect(scene()).toBeNull();
});
