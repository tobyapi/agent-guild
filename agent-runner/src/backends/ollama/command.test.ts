import { describe, expect, it } from 'vitest';
import { commandArguments, runLocalCommand } from './command.ts';
import { runRequest } from '../run.test-support.ts';

describe('local command sandbox', () => {
  it('範囲内の書き込みとネットワーク拒否をCLIへ明示する', () => {
    const args = commandArguments(runRequest('ollama'), 'echo ok');
    expect(args).toContain('sandbox_mode="workspace-write"');
    expect(args).toContain('sandbox_workspace_write.writable_roots=[]');
    expect(args).toContain('sandbox_workspace_write.network_access=false');
    expect(args).toContain('sandbox_workspace_write.exclude_slash_tmp=true');
    expect(args.at(-1)).toBe('echo ok');
  });

  it('書き込み権限なしの場合はread-onlyにする', () => {
    const req = runRequest('ollama');
    req.permissions.writeFiles = false;
    expect(commandArguments(req, 'echo ok')).toContain('sandbox_mode="read-only"');
  });

  it('範囲外への書き込み権限を付けた場合だけ隔離を外す', () => {
    const req = runRequest('ollama');
    req.permissions.writeAnywhere = true;
    req.permissions.webFetch = true;
    expect(commandArguments(req, 'echo ok')).toContain('sandbox_mode="danger-full-access"');
  });

  it('実行権限がなければ子プロセスを作らず拒否する', async () => {
    const req = runRequest('ollama');
    req.permissions.runCommands = false;
    await expect(runLocalCommand(req, 'echo ok', new AbortController().signal)).rejects.toHaveProperty(
      'code',
      'unsupported_permission',
    );
  });
});
