// @vitest-environment jsdom
import { cleanup, render, fireEvent } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { SkillUsage } from '@/shared/types/domain';
import { SkillUsageLabels } from './SkillUsageLabels';
afterEach(cleanup);
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
