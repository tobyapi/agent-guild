import { resolve } from 'node:path';
import { BackendError, isInside, type RunRequest } from '../types.ts';
import { object } from './json.ts';
import { readLocal } from './read.ts';

export async function readSkill(request: RunRequest, raw: string, signal: AbortSignal): Promise<string> {
  const args: unknown = JSON.parse(raw);
  if (
    !object(args) ||
    typeof args.name !== 'string' ||
    Object.keys(args).some((key) => !['name', 'path'].includes(key))
  ) {
    throw new BackendError('bad_request', 'Invalid API skill arguments.');
  }
  const skill = request.skills.find((skill) => skill.name === args.name);
  if (!skill) throw new BackendError('bad_request', 'Unknown API skill.');
  if (args.path === undefined) return `<untrusted_skill>\n${skill.body}\n</untrusted_skill>`;
  if (typeof args.path !== 'string' || !/^(?!\/|.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./-]+$/.test(args.path)) {
    throw new BackendError('bad_request', 'Invalid API skill asset path.');
  }
  const builtin = skill.files.find((file) => file.path === args.path);
  if (builtin) return `<untrusted_skill>\n${builtin.content}\n</untrusted_skill>`;
  if (!skill.dir) throw new BackendError('bad_request', 'Unknown API skill asset.');
  const path = resolve(skill.dir, args.path);
  if (!isInside(path, skill.dir))
    throw new BackendError('unsupported_permission', 'API skill asset is outside its root.');
  const authorized = {
    ...request,
    readableDirs: [skill.dir],
    permissions: { ...request.permissions, readFiles: true, readAnywhere: false },
  };
  return `<untrusted_skill>\n${await readLocal(authorized, path, signal)}\n</untrusted_skill>`;
}
