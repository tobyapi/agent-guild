import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { writeSkills } from '../skill-files.ts';
import type { RunRequest } from '../types.ts';

export async function prepareSkills(
  request: RunRequest,
): Promise<{ request: RunRequest; cleanup: () => Promise<void> }> {
  if (!request.permissions.skills || request.skills.length === 0) return { request, cleanup: () => Promise.resolve() };
  await mkdir(request.stateDir, { recursive: true });
  const root = await mkdtemp(join(request.stateDir, 'ollama-skills-'));
  const dir = join(root, 'skills');
  const cleanup = () => rm(root, { recursive: true, force: true });
  try {
    await writeSkills(dir, request.skills);
  } catch (error) {
    await cleanup();
    throw error;
  }
  return {
    request: {
      ...request,
      readableDirs: [...request.readableDirs, dir],
      skills: request.skills.map((skill) => ({
        ...skill,
        body: `${skill.body}\n\n付属ファイル: ${join(dir, skill.name)}`,
      })),
    },
    cleanup,
  };
}
