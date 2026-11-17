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
  const usage = { declared: ['a'], loaded: ['b'], supported: true, runId: 'r1' };
  const assertSeparateLabels = (container: HTMLElement) => {
    const details = container.querySelector('details')!;
    const summary = container.querySelector('summary')!;
    expect(details.open).toBe(false);
    expect(summary.textContent).toBe('スキルの記録投稿前操作（読込確認）：b');
    expect(summary.textContent).not.toContain('使用スキル：a');
    const labels = summary.querySelectorAll('span > span');
    expect(Array.from(labels, (label) => label.parentElement?.textContent)).toEqual(['投稿前操作（読込確認）：b']);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    expect(details.querySelector('summary + span')?.textContent).toBe('使用スキル：a');
    expect(details.querySelector('summary + span + p')?.textContent).toContain('エージェントが申告したスキル');
    expect(container.textContent).toContain('このコメントでの使用・実行成功の証明ではありません');
  };
  const first = render(<SkillUsageLabels usage={usage} />);
  assertSeparateLabels(first.container);
  first.unmount();
  const reloaded = render(<SkillUsageLabels usage={JSON.parse(JSON.stringify(usage)) as SkillUsage} />);
  assertSeparateLabels(reloaded.container);
});

it.each([false, 'error'] as const)(
  'does not imply completeness or an ending reason when cutoff lookup is %s',
  async (result) => {
    const api = vi.spyOn(chatApi, 'skillRecordTruncated');
    if (result === false) api.mockResolvedValue(false);
    else api.mockRejectedValue(new Error('lookup failed'));
    const view = render(
      <SkillUsageLabels usage={{ declared: ['a'], loaded: ['b'], supported: true, runId: 'r' }} messageId="message" />,
    );
    const details = view.container.querySelector('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('message'));
    expect(view.container.textContent).toContain('明示取消が対象');
    expect(view.container.textContent).toContain('内部中断・時間切れ・異常終了は対象外');
    expect(view.container.textContent).toContain('記録なしは完全性を保証せず');
    expect(view.container.textContent).toContain('最終投稿がないだけでは終了理由を判断できません');
    expect(view.container.textContent).not.toContain('以降の観測は打切り');
  },
);
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
