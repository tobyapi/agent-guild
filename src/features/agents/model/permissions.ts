// 固定権限の説明（docs/ui-design.md §6.3）。実効権限と権限の規則の判定は shared/lib/permissions（モックと共有）。
import { permissionLabel, PERMISSION_ORDER } from '@/shared/lib/permissions';
import type { PermissionKey, Permissions } from '@/shared/types/domain';
import { tBrain } from '../i18n/brain';

export { effectivePermissions, leakRisk, PERMISSION_ORDER, permissionRuleProblem } from '@/shared/lib/permissions';
export type { RuleProblem } from '@/shared/lib/permissions';

export interface PermissionText {
  label: string;
  description: string;
  /** 許可されているときに使う注意書き（空なら注意なし） */
  warning: string;
}

/** 説明の翻訳キー（docs/ui-design.md §6.3 の表） */
const DESCRIPTIONS = {
  webSearch: 'describeWebSearch',
  webFetch: 'describeWebFetch',
  readFiles: 'describeReadFiles',
  readAnywhere: 'describeReadAnywhere',
  writeFiles: 'describeWriteFiles',
  writeAnywhere: 'describeWriteAnywhere',
  runCommands: 'describeRunCommands',
  skills: 'describeSkills',
} as const satisfies Readonly<Record<PermissionKey, string>>;

const WARNINGS: Partial<Record<PermissionKey, 'warnWriteAnywhere' | 'warnRunCommands'>> = {
  writeAnywhere: 'warnWriteAnywhere',
  runCommands: 'warnRunCommands',
};

/** 権限の機能名と説明 */
export function permissionText(key: PermissionKey): PermissionText {
  const warning = WARNINGS[key];
  return {
    label: permissionLabel(key),
    description: tBrain(DESCRIPTIONS[key]),
    warning: warning === undefined ? '' : tBrain(warning),
  };
}

/** 注意書きのある権限のうち、許可しているもの（プレビューの札に出す） */
export function riskyGrants(permissions: Permissions): PermissionKey[] {
  return PERMISSION_ORDER.filter((key) => permissions[key] && WARNINGS[key] !== undefined);
}
