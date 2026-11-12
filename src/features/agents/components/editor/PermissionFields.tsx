import { useBackend } from '@/features/runtime';
import {
  modelPermissions,
  permissionRole,
  unrestrictedPermissions,
  unusablePermissions,
} from '@/shared/lib/permissionPolicy';
import { Icon } from '@/shared/ui';
import type { Permissions } from '@/shared/types/domain';
import { useTemplates } from '../../hooks/useAgents';
import { tBrain } from '../../i18n/brain';
import { PERMISSION_ORDER, permissionText } from '../../model/permissions';
import { EditorSection } from './EditorSection';
import styles from './PermissionFields.module.css';

export interface PermissionFieldsProps {
  backendId: string;
  model: string;
  options: Readonly<Record<string, unknown>>;
  tags: readonly string[];
  /** 役割で決まる権限（どのバックエンドでも同じ） */
  permissions: Permissions;
  error?: string;
}

const labels = (keys: readonly (keyof Permissions)[]) =>
  keys.map((key) => permissionText(key).label).join(tBrain('listSeparator'));

function grantStatus(granted: boolean, usable: boolean): string {
  if (!granted) return tBrain('notGranted');
  return usable ? tBrain('allowed') : tBrain('allowedUnused');
}

/**
 * 役割で決まる権限を説明する。権限はどの AI でも同じで、AI によって違うのは「その AI では使わない操作」だけ
 * （守れない操作を外すだけで、権限を広げて使えるようにはしない）。個別の権限スイッチは置かない。
 */
export function PermissionFields({ backendId, model, options, tags, permissions, error }: PermissionFieldsProps) {
  const backend = useBackend(backendId);
  const role = permissionRole(useTemplates(), tags);
  const granted = PERMISSION_ORDER.filter((key) => permissions[key]);
  const usable = modelPermissions(permissions, backend, model, options);
  const unusable = unusablePermissions(permissions, backend, model, options);
  const unrestricted = unrestrictedPermissions(permissions, backend);
  const reasonOf = (key: keyof Permissions) => unusable.find((item) => item.key === key)?.reason;
  return (
    <EditorSection title={tBrain('permissionsSection')}>
      <p>{role ? tBrain('roleGrants', { role: role.label }) : tBrain('noRole')}</p>
      <p className={styles.description}>
        {granted.length > 0 ? tBrain('grantedList', { list: labels(granted) }) : tBrain('chatOnly')}
      </p>
      {unusable.length > 0 && backend && (
        <div className={styles.description} role="note">
          <p>{tBrain('unusableIntro', { backend: backend.label })}</p>
          <ul className={styles.reasons}>
            {unusable.map(({ key, reason }) => (
              <li key={key}>
                {permissionText(key).label}: {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {unrestricted.length > 0 && backend && (
        <p className={styles.notice} role="note">
          <Icon name="alert" className={styles.warningIcon} />
          {tBrain('unrestricted', { backend: backend.label, list: labels(unrestricted) })}
        </p>
      )}
      {!backend && <p className={styles.description}>{tBrain('noBackendYet')}</p>}
      {usable.readAnywhere && !usable.writeAnywhere && (
        <p className={styles.notice} role="note">
          {tBrain('readOutside')}
        </p>
      )}
      {usable.writeAnywhere && (
        <p className={styles.notice} role="note">
          <Icon name="alert" className={styles.warningIcon} />
          {tBrain('writeAnywhereNotice')}
        </p>
      )}
      {error && (
        <p className={styles.notice} role="alert">
          {error}
        </p>
      )}
      <details className={styles.details}>
        <summary>{tBrain('listSummary')}</summary>
        <ul className={styles.list} aria-label={tBrain('listLabel')}>
          {PERMISSION_ORDER.map((key) => (
            <li key={key} className={styles.grant} data-granted={permissions[key] ? '' : undefined}>
              <span>{permissionText(key).label}</span>
              <span className={styles.status} data-allowed={usable[key] ? '' : undefined} title={reasonOf(key)}>
                {grantStatus(permissions[key], usable[key])}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </EditorSection>
  );
}
