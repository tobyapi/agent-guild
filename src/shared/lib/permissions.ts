// 権限の名前と、実効権限・バックエンドの権限の規則（BackendInfo.permissionRules）の判定（docs/design.md §2・§5）。
// Rust の保存時検証（guild-domain の agent/validation.rs）と同じ判定を、編集画面とモックで使う。
import type { BackendInfo, PermissionKey, Permissions } from '@/shared/types/domain';

/** 表示の順 */
export const PERMISSION_ORDER: readonly PermissionKey[] = [
  'webSearch',
  'webFetch',
  'readFiles',
  'writeFiles',
  'writeAnywhere',
  'runCommands',
  'skills',
];

export const PERMISSION_LABELS: Readonly<Record<PermissionKey, string>> = {
  webSearch: 'Web 検索',
  webFetch: 'Web ページを読む',
  readFiles: 'ファイルを読む',
  writeFiles: 'ファイルを書く',
  writeAnywhere: '作業フォルダの外にも書く',
  runCommands: 'コマンドを実行',
  skills: 'スキルを使う',
};

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

const quoted = (keys: readonly PermissionKey[]) => keys.map((key) => `「${PERMISSION_LABELS[key]}」`).join('と');

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
    const head = `${backend.label}で「${PERMISSION_LABELS[rule.when]}」を使うには${quoted(missing)}も必要です`;
    const grantable = missing.every((key) => backend.capabilities[key]);
    return grantable
      ? { field: 'permissions', message: `${head}。${quoted(missing)}を許可してください` }
      : { field: 'backend', message: `${head}。${backend.label}では使えないので、別のバックエンドを選んでください` };
  }
  return null;
}
