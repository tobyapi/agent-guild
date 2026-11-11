import type { RunRequest } from '../types.ts';
import { executeTool, sandbox } from './tools.ts';

export async function fileTool(
  request: RunRequest,
  tool: string,
  path: string,
  content: string,
  signal: AbortSignal,
): Promise<string> {
  return executeTool(request, tool, { path, content }, signal, await sandbox(request));
}
