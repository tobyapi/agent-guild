// 権限は役割（先頭タグ）だけで決まり、どのバックエンドでも同じ（rolePermissions）。バックエンドで違ってよいのは
// 「その AI で実際に使える操作」だけで、役割の権限を広げずに求める（supportedPermissions・modelPermissions）。
// Rust の agent/permission_policy.rs と同じ規則を UI とモックで使う。
import type { AgentTemplate, BackendInfo, PermissionKey, Permissions } from '@/shared/types/domain';
import { normalizeName } from './names';
import { effectivePermissions, PERMISSION_LABELS, PERMISSION_ORDER } from './permissions';

export function permissionRole(
  templates: readonly AgentTemplate[],
  tags: readonly string[],
): AgentTemplate | undefined {
  const head = normalizeName(tags[0] ?? '');
  return templates.find((template) => normalizeName(template.defaults.tags[0] ?? '') === head);
}

/** 役割未設定は参照とスキルだけ。独自タグを作業者として扱わない。 */
export function rolePermissions(templates: readonly AgentTemplate[], tags: readonly string[]): Permissions {
  return {
    ...(permissionRole(templates, tags)?.defaults.permissions ?? {
      webSearch: false,
      webFetch: false,
      readFiles: true,
      readAnywhere: false,
      writeFiles: false,
      writeAnywhere: false,
      runCommands: false,
      skills: true,
    }),
  };
}

/** 役割の権限のうち、そのバックエンドで使える操作。許可範囲を広げず、道具がない操作と、単独では守れない操作を取り除く。 */
export function supportedPermissions(permissions: Permissions, backend: BackendInfo | undefined): Permissions {
  const effective = effectivePermissions(permissions, backend?.capabilities);
  if (!backend) return effective;
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of backend.permissionRules) {
      if (effective[rule.when] && rule.requires.some((key) => !effective[key])) {
        effective[rule.when] = false;
        changed = true;
      }
    }
  }
  return effective;
}

/** 役割の権限のうち、その AI（バックエンド・モデル・設定）で使える操作。Ollama は明示的な有効化とアプリ側の道具対応が必要。 */
export function modelPermissions(
  permissions: Permissions,
  backend: BackendInfo | undefined,
  model: string,
  options: Readonly<Record<string, unknown>>,
  backendId = backend?.id,
): Permissions {
  if (
    backendId === 'ollama' &&
    (options.enableTools !== true ||
      backend?.models.find((candidate) => candidate.id === (model || backend.defaultModel))?.tools !== true)
  ) {
    return Object.fromEntries(Object.keys(permissions).map((key) => [key, false])) as Permissions;
  }
  return supportedPermissions(permissions, backend);
}

export interface UnusablePermission {
  key: PermissionKey;
  /** 使えない理由（画面に出す文） */
  reason: string;
}

const quoted = (keys: readonly PermissionKey[]) => keys.map((key) => `「${PERMISSION_LABELS[key]}」`).join('と');

/**
 * 役割では許可されているのに、その AI では使わない操作と理由。権限を広げて使えるようにはしない
 * （守れない操作を外すだけ）ので、利用者に権限の変更は促さない。
 */
export function unusablePermissions(
  permissions: Permissions,
  backend: BackendInfo | undefined,
  model: string,
  options: Readonly<Record<string, unknown>>,
  backendId = backend?.id,
): UnusablePermission[] {
  if (!backend) return [];
  const usable = modelPermissions(permissions, backend, model, options, backendId);
  const withTools = supportedPermissions(permissions, backend);
  return PERMISSION_ORDER.filter((key) => permissions[key] && !usable[key]).map((key) => {
    if (withTools[key]) {
      return { key, reason: '「道具の利用を有効にする」をオンにして、道具に対応したモデルを選ぶと使えます' };
    }
    if (!backend.capabilities[key]) return { key, reason: `${backend.label}には、この操作の道具がありません` };
    const rule = backend.permissionRules.find((candidate) => candidate.when === key);
    const missing = rule?.requires.filter((required) => !withTools[required]) ?? [];
    const needs = missing.length > 0 ? `${quoted(missing)}も許されている役割でだけ使います` : '使いません';
    return { key, reason: `${backend.label}では単独で安全に守れないため、${needs}` };
  });
}

/**
 * 役割では許可していないのに、そのバックエンドでは止められない操作（BackendInfo.unrestricted）。
 * 権限は役割で決まるが、これらだけは役割の権限より広く動きうるので、編集画面で知らせる。
 */
export function unrestrictedPermissions(permissions: Permissions, backend: BackendInfo | undefined): PermissionKey[] {
  if (!backend) return [];
  // 作業フォルダの外にも書ける役割は、外も読める（外のファイルを直すには読む必要がある）
  const granted = { ...permissions, readAnywhere: permissions.readAnywhere || permissions.writeAnywhere };
  return PERMISSION_ORDER.filter((key) => backend.unrestricted.includes(key) && !granted[key]);
}
