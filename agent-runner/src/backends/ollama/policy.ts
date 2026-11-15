import type { PermissionRule } from '../../protocol.ts';
import { BackendError, brokenRule, type RunRequest } from '../types.ts';
import { t } from './texts/index.ts';

export const PERMISSION_RULES: PermissionRule[] = [
  { when: 'writeAnywhere', requires: ['writeFiles'] },
  { when: 'runCommands', requires: ['readFiles'] },
];

export function validatePermissions(request: RunRequest): void {
  if (
    request.permissions.webSearch ||
    request.permissions.webFetch ||
    request.permissions.readAnywhere ||
    brokenRule(PERMISSION_RULES, request.permissions)
  )
    throw new BackendError('unsupported_permission', t('permissions'));
}
