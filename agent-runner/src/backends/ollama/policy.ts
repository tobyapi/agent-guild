import type { PermissionRule } from '../../protocol.ts';
import { BackendError, brokenRule, type RunRequest } from '../types.ts';
import { assertFolderScope } from '../folder-scope.ts';

export const PERMISSION_RULES: PermissionRule[] = [
  { when: 'writeAnywhere', requires: ['writeFiles'] },
  { when: 'runCommands', requires: ['readFiles'] },
];

export function validatePermissions(request: RunRequest): void {
  assertFolderScope(request);
  if (
    request.permissions.webSearch ||
    request.permissions.webFetch ||
    request.permissions.readAnywhere ||
    brokenRule(PERMISSION_RULES, request.permissions)
  )
    throw new BackendError(
      'unsupported_permission',
      'Ollama の権限の組み合わせを確認してください。Web と readAnywhere は未対応です。',
    );
}
