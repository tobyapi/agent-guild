import { BackendError, type RunContext, type RunRequest } from '../types.ts';
import { object } from './json.ts';
import { readLocal } from './read.ts';
import { readSkill } from './skills.ts';
import { fetchURL } from './fetch-url.ts';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface Call {
  id: string;
  name: string;
  args: string;
  wireId?: string;
}
const fields: Record<string, string> = { read_file: 'path', read_skill: 'name', fetch_url: 'url', post: 'text' };
function tool(name: string): Tool {
  const field = fields[name]!;
  return {
    name,
    description: name,
    parameters: {
      type: 'object',
      properties: { [field]: { type: 'string' }, ...(name === 'read_skill' ? { path: { type: 'string' } } : {}) },
      required: [field],
      additionalProperties: false,
    },
  };
}
export function tools(request: RunRequest): Tool[] {
  const p = request.permissions;
  return [
    ...(p.readFiles ? [tool('read_file')] : []),
    ...(p.skills ? [tool('read_skill')] : []),
    ...(p.webFetch ? [tool('fetch_url')] : []),
    tool('post'),
  ];
}
/** Validate the complete batch before any effects. Execution rechecks grants as well. */
export function validateCall(request: RunRequest, call: Call): Record<string, string> {
  if (!tools(request).some((tool) => tool.name === call.name))
    throw new BackendError('unsupported_permission', 'API tool is not permitted.');
  if (!call.id || call.id.length > 256 || call.args.length > 32768)
    throw new BackendError('bad_request', 'Invalid API tool call.');
  let args: unknown;
  try {
    args = JSON.parse(call.args);
  } catch {
    throw new BackendError('bad_request', 'Invalid API tool arguments.');
  }
  const field = fields[call.name]!;
  const allowed = call.name === 'read_skill' ? [field, 'path'] : [field];
  if (
    !object(args) ||
    typeof args[field] !== 'string' ||
    Object.entries(args).some(([key, value]) => !allowed.includes(key) || typeof value !== 'string')
  )
    throw new BackendError('bad_request', 'Invalid API tool arguments.');
  return args as Record<string, string>;
}
export async function execute(request: RunRequest, context: RunContext, call: Call): Promise<string> {
  context.signal.throwIfAborted();
  const args = validateCall(request, call);
  if (call.name === 'post') {
    context.onPost(args.text!);
    return 'posted';
  }
  if (call.name === 'read_skill') {
    const result = await readSkill(request, call.args, context.signal);
    context.signal.throwIfAborted();
    if (args.path === undefined) context.onSkillRead?.(args.name!, `backend:${call.id}`);
    return result;
  }
  if (call.name === 'read_file')
    return `<untrusted_file>\n${await readLocal(request, args.path!, context.signal)}\n</untrusted_file>`;
  return `<untrusted_web>\n${await fetchURL(args.url!, context.signal)}\n</untrusted_web>`;
}
