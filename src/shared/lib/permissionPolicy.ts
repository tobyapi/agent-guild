// 役割の固定権限。Rust の agent/permission_policy.rs と同じ規則を UI とモックで使う。
import type { AgentTemplate, BackendInfo, Permissions } from '@/shared/types/domain';
import { normalizeName } from './names';
import { effectivePermissions } from './permissions';

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

/** 許可範囲を広げず、非対応の操作と依存関係を満たせない操作を取り除く。 */
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

/** Ollama は明示的な有効化と、選択モデルの tools 対応の両方が必要。 */
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
