// 権限の名前と、実効権限・バックエンドの権限の規則（BackendInfo.permissionRules）・持ち出しの危険（leakRisks）の判定
// （docs/design.md §2・§5）。権限の規則は Rust の保存時検証（guild-domain の agent/validation.rs）と同じ判定を、編集画面とモックで使う。
import type { BackendInfo, PermissionKey, Permissions } from '@/shared/types/domain';
import { t } from './i18n';

/** 表示の順 */
export const PERMISSION_ORDER: readonly PermissionKey[] = [
  'webSearch',
  'webFetch',
  'readFiles',
  'readAnywhere',
  'writeFiles',
  'writeAnywhere',
  'runCommands',
  'skills',
];

/** 権限の名前（いまの言語） */
export function permissionLabel(key: PermissionKey): string {
  return t(`perm_${key}`);
}

/**
 * 権限の名前の表。値は読むたびにいまの言語で引く（getter）ので、言語を切り替えても古い名前が残らない。
 * 新しいコードでは permissionLabel を使う
 */
export const PERMISSION_LABELS: Readonly<Record<PermissionKey, string>> = Object.freeze(
  Object.defineProperties(
    {},
    Object.fromEntries(PERMISSION_ORDER.map((key) => [key, { enumerable: true, get: () => permissionLabel(key) }])),
  ) as Record<PermissionKey, string>,
);

/** 権限の名前を括弧でくくって並べる（例: 「ファイルを読む」と「Web 検索」） */
export function quotedPermissions(keys: readonly PermissionKey[]): string {
  return keys.map((key) => t('quote', { text: permissionLabel(key) })).join(t('and'));
}

/** 実効権限 = エージェントの権限 ∧ バックエンドの能力（能力が分からなければ絞らない） */
export function effectivePermissions(permissions: Permissions, capabilities: Permissions | undefined): Permissions {
  const entries = PERMISSION_ORDER.map((key) => [key, permissions[key] && (capabilities?.[key] ?? true)] as const);
  return Object.fromEntries(entries) as Permissions;
}

export interface RuleProblem {
  /** 直す場所: 足りない権限をバックエンドが持つなら permissions、持たなければ backend */
  field: 'permissions' | 'backend';
  message: string;
}

/**
 * バックエンドの権限の規則（BackendInfo.permissionRules）に実効権限が反していれば、その説明（Rust の保存時検証と同じ判定）。
 * バックエンドが分からなければ null
 */
export function permissionRuleProblem(backend: BackendInfo | undefined, permissions: Permissions): RuleProblem | null {
  if (!backend) return null;
  const effective = effectivePermissions(permissions, backend.capabilities);
  for (const rule of backend.permissionRules) {
    const missing = effective[rule.when] ? rule.requires.filter((key) => !effective[key]) : [];
    if (missing.length === 0) continue;
    const head = t('ruleHead', {
      backend: backend.label,
      permission: quotedPermissions([rule.when]),
      missing: quotedPermissions(missing),
    });
    const grantable = missing.every((key) => backend.capabilities[key]);
    return grantable
      ? { field: 'permissions', message: t('ruleGrant', { head, missing: quotedPermissions(missing) }) }
      : { field: 'backend', message: t('ruleOtherBackend', { head, backend: backend.label }) };
  }
  return null;
}

/**
 * 実効権限が持ち出しの危険がある組（BackendInfo.leakRisks）のどれかをすべて満たしていれば、その知らせ。
 * 保存は止めない（任せる仕事しだいで、知ったうえで許してよい）。バックエンドが分からなければ null
 */
export function leakRisk(backend: BackendInfo | undefined, permissions: Permissions): string | null {
  if (!backend) return null;
  const effective = effectivePermissions(permissions, backend.capabilities);
  const risk = backend.leakRisks.find((keys) => keys.length > 0 && keys.every((key) => effective[key]));
  if (!risk) return null;
  const quotedRisk = quotedPermissions(risk);
  const head =
    risk.length === 1
      ? t('leakHeadSingle', { backend: backend.label, risk: quotedRisk })
      : t('leakHeadAll', { risk: quotedRisk });
  return t('leakBody', { head });
}
