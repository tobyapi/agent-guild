// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import backends from '../../../../../contracts/runner/api-backends.json';
import type { AgentInput, BackendInfo } from '@/shared/types/domain';
import { BrainFields } from './BrainFields';
import { newDraft, changeModel, draftFromAgent, type AgentDraft } from '../../model/draft';
import { validateAgentDraft } from '../../model/validation';
import { agentFixture, TEMPLATES } from '../../model/fixtures.test-support';

const catalog = backends as BackendInfo[];
vi.mock('@/features/runtime', async (original) => ({
  ...(await original<typeof import('@/features/runtime')>()),
  useBackends: () => catalog,
}));
afterEach(cleanup);

function Harness({
  backend,
  onSave,
  saved,
}: {
  backend: BackendInfo;
  onSave: (input: AgentInput) => void;
  saved?: AgentInput;
}) {
  const initial: AgentDraft = saved
    ? draftFromAgent(agentFixture(saved), catalog)
    : { ...newDraft(TEMPLATES[0], [backend], 0), name: 'APIテスト', backend: backend.id };
  const [draft, setDraft] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const result = validateAgentDraft(draft, { backends: catalog, templates: TEMPLATES, takenNames: [] });
        if (!result.ok) throw new Error(JSON.stringify(result));
        onSave(result.input);
      }}
    >
      <BrainFields
        draft={draft}
        errors={{}}
        optionErrors={{}}
        update={(key, value) => setDraft((draft) => ({ ...draft, [key]: value }))}
        onBackend={(id) => setDraft((draft) => ({ ...draft, backend: id, model: '', effort: '' }))}
        onModel={(model) => setDraft((draft) => changeModel(draft, model, backend))}
      />
      <button type="submit">保存</button>
    </form>
  );
}
it.each(catalog)('$id selects listed models and supported efforts and preserves both after save/remount', (backend) => {
  const onSave = vi.fn<(input: AgentInput) => void>();
  const view = render(<Harness backend={backend} onSave={onSave} />);
  const model = screen.getByRole<HTMLSelectElement>('combobox', { name: 'モデル' });
  expect([...model.options].map((option) => option.value)).toEqual(['', ...backend.models.map((model) => model.id)]);
  const selected = backend.models[0]!;
  fireEvent.change(model, { target: { value: selected.id } });
  const effort = screen.getByRole<HTMLSelectElement>('combobox', { name: '推論の深さ' });
  expect([...effort.options].map((option) => option.value)).toEqual(['', ...selected.efforts]);
  fireEvent.change(effort, { target: { value: selected.efforts.at(-1) } });
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  const saved = onSave.mock.calls[0]![0];
  expect(saved).toMatchObject({
    backend: backend.id,
    model: selected.id,
    backendOptions: { effort: selected.efforts.at(-1) },
  });
  view.unmount();
  render(<Harness backend={backend} onSave={onSave} saved={saved} />);
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'モデル' }).value).toBe(selected.id);
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: '推論の深さ' }).value).toBe(selected.efforts.at(-1));
  expect(screen.queryByRole('switch', { name: '道具の利用を有効にする' })).toBeNull();
});
