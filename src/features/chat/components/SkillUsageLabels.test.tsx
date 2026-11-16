// @vitest-environment jsdom
import { cleanup, render, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { SkillUsage } from '@/shared/types/domain';
import { chatApi } from '../api';
import { SkillUsageLabels } from './SkillUsageLabels';
afterEach(cleanup);
afterEach(() => vi.restoreAllMocks());
it('loads job cutoff on opening details without altering saved labels', async () => {
  const api = vi.spyOn(chatApi, 'skillRecordTruncated').mockResolvedValue(true);
  const usage = { declared: [], loaded: ['reflection'], supported: true, runId: 'private-run' };
  const view = render(<SkillUsageLabels usage={usage} messageId="message" />);
  expect(api).not.toHaveBeenCalled();
  const details = view.container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await waitFor(() => expect(view.container.textContent).toContain('以降の観測は打切り'));
  expect(api).toHaveBeenCalledWith('message');
  expect(view.container.querySelector('summary')?.textContent).toContain('reflection');
  expect(view.container.textContent).not.toContain('private-run');
  expect(usage.loaded).toEqual(['reflection']);
});
it('persisted declarations and reads stay distinct after remount', () => {
  const usage = { declared: ['clean-code'], loaded: ['reflection'], supported: true, runId: 'r1' };
  const view = render(<SkillUsageLabels usage={JSON.parse(JSON.stringify(usage)) as SkillUsage} />);
  expect(view.container.querySelector('summary')?.textContent).toContain('申告');
  expect(view.container.querySelector('summary')?.textContent).toContain('読込確認');
  fireEvent.click(view.container.querySelector('summary')!);
  expect(view.container.textContent).toContain('前の投稿');
});
it('legacy and unsupported have no skill labels and distinct detail', () => {
  const view = render(<SkillUsageLabels />);
  expect(view.container.querySelectorAll('summary span').length).toBe(1);
  expect(view.container.textContent).toContain('記録なし');
  view.rerender(<SkillUsageLabels usage={{ declared: [], loaded: [], supported: false, runId: 'r' }} />);
  expect(view.container.textContent).toContain('取得非対応');
});
it('incomplete collection is unknown and does not reveal internal identifiers', () => {
  const view = render(
    <SkillUsageLabels
      usage={{
        declared: [],
        loaded: ['unreliable-read'],
        supported: true,
        runId: 'private-run',
        interval: {
          version: 1,
          agentId: 'private-agent',
          start: 0,
          end: 35,
          incomplete: true,
        },
      }}
    />,
  );
  expect(view.container.textContent).toContain('不明');
  expect(view.container.textContent).not.toContain('private-');
  expect(view.container.querySelector('summary')?.textContent).not.toContain('unreliable-read');
});
