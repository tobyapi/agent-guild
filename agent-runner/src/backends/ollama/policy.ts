import type { PermissionRule } from '../../protocol.ts';
import { BackendError, brokenRule, type RunRequest } from '../types.ts';

// コマンドの読み取りは Codex と同じく範囲外も可能。書き込みとネットワークは OS で制限する。
export const PERMISSION_RULES: PermissionRule[] = [
  { when: 'runCommands', requires: ['readFiles', 'skills'] },
  { when: 'webFetch', requires: ['runCommands'] },
  { when: 'writeAnywhere', requires: ['writeFiles', 'webFetch'] },
];

export function validatePermissions(request: RunRequest): void {
  if (request.permissions.webSearch || brokenRule(PERMISSION_RULES, request.permissions)) {
    throw new BackendError(
      'unsupported_permission',
      'Ollama の権限の組み合わせを確認してください。Web検索は未対応です。',
    );
  }
}
