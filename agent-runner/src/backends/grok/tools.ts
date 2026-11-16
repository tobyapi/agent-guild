import { BackendError, type RunContext, type RunRequest } from '../types.ts';
import { object, type Item } from './response.ts';
import { readLocal } from './read.ts';
import { fetchURL } from './fetch-url.ts';
import { readSkill } from './skills.ts';

function tool(name: string, field: string): Item {
  const properties = { [field]: { type: 'string' }, ...(name === 'read_skill' ? { path: { type: 'string' } } : {}) };
  return { type: 'function', name, description: name,
    parameters: { type: 'object', properties, required: [field], additionalProperties: false } };
}

export function tools(request: RunRequest): Item[] {
  const p = request.permissions;
  return [
    ...(p.webSearch && p.webFetch ? [{ type: 'web_search' }, { type: 'x_search' }] : []),
    ...(p.readFiles ? [tool('read_file', 'path')] : []),
    ...(p.webFetch ? [tool('fetch_url', 'url')] : []),
    ...(p.skills ? [tool('read_skill', 'name')] : []),
    tool('post', 'text'),
  ];
}

function argument(name: string, raw: string): string {
  if (raw.length > 32768) throw new BackendError('bad_request', 'Invalid Grok tool arguments.');
  let args: unknown;
  try { args = JSON.parse(raw); } catch { throw new BackendError('bad_request', 'Invalid Grok tool arguments.'); }
  const fields: Record<string, string> = { read_file: 'path', fetch_url: 'url', read_skill: 'name', post: 'text' };
  const field = fields[name];
  if (!field || !object(args) || Object.keys(args).length !== 1 || typeof args[field] !== 'string') {
    throw new BackendError('bad_request', 'Invalid Grok tool arguments.');
  }
  return args[field];
}

export async function execute(request: RunRequest, context: RunContext, name: string, raw: string): Promise<string> {
  context.signal.throwIfAborted();
  const registered = tools(request).find(tool => tool.type === 'function' && tool.name === name);
  if (!registered) throw new BackendError('unsupported_permission', 'Grok tool is not permitted.');
  if (name === 'read_skill') return readSkill(request, raw, context.signal);
  const value = argument(name, raw);
  if (name === 'read_file') {
    return `<untrusted_file>\n${await readLocal(request, value, context.signal)}\n</untrusted_file>`;
  }
  if (name === 'fetch_url') {
    return `<untrusted_web>\n${await fetchURL(value, context.signal)}\n</untrusted_web>`;
  }
  if (name === 'post') {
    context.signal.throwIfAborted();
    context.onPost(value);
    return 'posted';
  }
  throw new BackendError('bad_request', 'Invalid Grok tool arguments.');
}
