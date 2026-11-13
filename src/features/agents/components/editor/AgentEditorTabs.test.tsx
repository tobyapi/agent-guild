// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useState } from 'react';
import { AgentEditorPanel, AgentEditorTabs } from './AgentEditorTabs';
import type { EditorTab } from './AgentEditorTabs';

afterEach(cleanup);

function Harness({
  errorTabs,
  showSkills,
  submitAttempt,
}: {
  errorTabs: EditorTab[];
  showSkills: boolean;
  submitAttempt: number;
}) {
  const [selection, setSelection] = useState<{ tab: EditorTab; submitAttempt: number }>({
    tab: 'basics',
    submitAttempt: 0,
  });
  const tabs: EditorTab[] = showSkills
    ? ['basics', 'persona', 'behavior', 'brain', 'skills']
    : ['basics', 'persona', 'behavior', 'brain'];
  const firstError = tabs.find((tab) => errorTabs.includes(tab));
  const selected = selection.submitAttempt === submitAttempt ? selection.tab : (firstError ?? selection.tab);
  const onSelect = (tab: EditorTab) => setSelection({ tab, submitAttempt });
  const id = 'agent';
  return (
    <>
      <AgentEditorTabs
        id={id}
        errorTabs={errorTabs}
        showSkills={showSkills}
        tabsLabel="agent"
        selected={selected}
        onSelect={onSelect}
      />
      <form>
        <AgentEditorPanel id={id} tab="basics" selected={selected}>
          <input aria-label="draft name" />
        </AgentEditorPanel>
        <AgentEditorPanel id={id} tab="persona" selected={selected}>
          <p>persona content</p>
        </AgentEditorPanel>
        <AgentEditorPanel id={id} tab="behavior" selected={selected}>
          <p>behavior content</p>
        </AgentEditorPanel>
        <AgentEditorPanel id={id} tab="brain" selected={selected}>
          <p>brain content</p>
        </AgentEditorPanel>
      </form>
      {showSkills && (
        <AgentEditorPanel id={id} tab="skills" selected={selected}>
          <p>skills content</p>
        </AgentEditorPanel>
      )}
    </>
  );
}

it('切り替えたパネルの入力を保ち、保存試行後に最初のエラータブへ移る', () => {
  const view = render(<Harness errorTabs={[]} showSkills submitAttempt={0} />);
  const nameInput = screen.getByRole<HTMLInputElement>('textbox', { name: 'draft name' });
  fireEvent.change(nameInput, { target: { value: 'Luna' } });
  fireEvent.click(screen.getByRole('tab', { name: '人格' }));
  expect(screen.getByRole('tabpanel').textContent).toBe('persona content');
  expect(nameInput.value).toBe('Luna');

  view.rerender(<Harness errorTabs={['basics', 'brain']} showSkills submitAttempt={1} />);
  expect(screen.getByRole('tab', { name: /基本/ }).getAttribute('aria-selected')).toBe('true');
  expect(within(screen.getByRole('tab', { name: /基本/ })).getByText('このタブに入力エラーがあります')).toBeTruthy();
});

it('矢印キー・Home・Endでタブを切り替え、作成時はスキルを表示しない', () => {
  render(<Harness errorTabs={[]} showSkills={false} submitAttempt={0} />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { selected: true }).textContent).toBe('人格');
  fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'End' });
  expect(screen.getByRole('tab', { selected: true }).textContent).toBe('AI と権限');
  fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'Home' });
  expect(screen.getByRole('tab', { selected: true }).textContent).toBe('基本');
});
