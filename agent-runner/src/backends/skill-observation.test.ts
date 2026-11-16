import { expect, it, vi } from 'vitest';
import { execute } from './grok/tools.ts';
import { executeTool } from './ollama/tools.ts';
import { runContext, runRequest } from './run.test-support.ts';
it.each(['grok', 'ollama'])('%s only observes successful dedicated reads', async (backend) => {
  const request = {
    ...runRequest(backend),
    options: { enableTools: true },
    skills: [{ name: 'review', description: '', body: 'instructions', dir: null, files: [] }],
  };
  const context = { ...runContext(), onSkillRead: vi.fn() };
  const read = (name: string) =>
    backend === 'grok'
      ? execute(request, context, 'read_skill', JSON.stringify({ name }))
      : executeTool(
          request,
          'read_skill',
          { name },
          context.signal,
          { profile: '', workspace: request.workspace, isolated: false },
          context,
        );
  await expect(read('missing')).rejects.toThrow();
  expect(context.onSkillRead).not.toHaveBeenCalled();
  expect(await read('review')).toContain('instructions');
  expect(context.onSkillRead).toHaveBeenCalledExactlyOnceWith('review');
});
