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
    const labels = container.querySelectorAll('summary > span > span');
    expect(Array.from(labels, (label) => label.parentElement?.textContent)).toEqual([
      '使用スキル（申告）：a',
      '投稿前操作（読込確認）：b',
    ]);
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
it.each([undefined, null, false, true])('omits the whole record area when no names exist (%s)', (supported) => {
  const usage = supported == null ? supported : { declared: [], loaded: [], supported, runId: 'r' };
  const view = render(<SkillUsageLabels usage={usage} />);
  expect(view.container.innerHTML).toBe('');
});
it('omits invalid entries and hides records with no valid names', () => {
  const invalid = ['', ' ', '<skill-name>', 'bad name'];
  const view = render(<SkillUsageLabels usage={{ declared: invalid, loaded: invalid, supported: true, runId: 'r' }} />);
  expect(view.container.innerHTML).toBe('');
  view.rerender(
    <SkillUsageLabels
      usage={{ declared: [...invalid, 'clean-code'], loaded: ['reflection', ...invalid], supported: true, runId: 'r' }}
    />,
  );
  expect(view.container.querySelector('summary')?.textContent).toContain('clean-code');
  expect(view.container.querySelector('summary')?.textContent).toContain('reflection');
  expect(view.container.textContent).not.toContain('<skill-name>');
  expect(view.container.textContent).not.toContain('bad name');
  view.rerender(<SkillUsageLabels usage={null} />);
  expect(view.container.innerHTML).toBe('');
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
