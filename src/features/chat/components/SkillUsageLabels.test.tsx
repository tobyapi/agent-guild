// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SkillUsageLabels } from './SkillUsageLabels';

afterEach(cleanup);

it('使用申告であることと根拠を表示する', () => {
  const view = render(<SkillUsageLabels names={['clean-code', 'reflection']} />);
  expect(screen.getByText('clean-code')).toBeTruthy();
  expect(screen.getByText('reflection')).toBeTruthy();
  expect(view.container.querySelector('summary')?.textContent).toContain('申告');
  expect(view.container.querySelector('details p')?.textContent).toContain('未使用とは限りません');
});

it('記録なしを未使用と表示しない', () => {
  const view = render(<SkillUsageLabels names={[]} />);
  expect(view.container.innerHTML).toBe('');
});
