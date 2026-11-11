import { BackendError, type RunRequest } from '../types.ts';
import { executeTool, sandbox } from './tools.ts';

export async function runLocalCommand(request: RunRequest, command: string, signal: AbortSignal): Promise<string> {
  const result = await executeTool(request, 'run_command', { command }, signal, await sandbox(request));
  const match = /^exit=(\d+|null)\n([\s\S]*)$/.exec(result);
  if (!match) throw new BackendError('internal', 'コマンドの応答が不正です');
  return JSON.stringify({ exitCode: match[1] === 'null' ? null : Number(match[1]), output: match[2], stopped: false });
}
