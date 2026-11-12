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

const labels = (keys: readonly (keyof Permissions)[]) => keys.map((key) => permissionText(key).label).join('・');

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
    <EditorSection title="できること">
      <p>
        {role
          ? `${role.label}の権限です。どの AI を選んでも同じで、役割を変えると切り替わります。`
          : '役割が未設定のため、参照とスキルだけを許可しています。上のカードで役割を選べます。'}
      </p>
      <p className={styles.description}>
        {granted.length > 0 ? `許可している操作：${labels(granted)}` : 'この役割は会話だけで答えます。'}
      </p>
      {unusable.length > 0 && backend && (
        <div className={styles.description} role="note">
          <p>{backend.label}では、このうち次の操作を使いません（権限は変えずに、守れない操作だけを外します）。</p>
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
          {backend.label}は仕組みの制約で、この役割で許可していない次の操作を止められません：{labels(unrestricted)}
          。秘密を扱う仕事は、止められる AI に任せてください。
        </p>
      )}
      {!backend && <p className={styles.description}>AI の準備ができると、使える操作を確認します。</p>}
      {usable.readAnywhere && !usable.writeAnywhere && (
        <p className={styles.notice} role="note">
          作業フォルダの外も読めます。書き込みは作業フォルダ内だけです。
        </p>
      )}
      {usable.writeAnywhere && (
        <p className={styles.notice} role="note">
          <Icon name="alert" className={styles.warningIcon} />
          この役割は、パソコン内のファイル変更・削除、ソフトのインストール、外部への通信も行えます。
        </p>
      )}
      {error && (
        <p className={styles.notice} role="alert">
          {error}
        </p>
      )}
      <details className={styles.details}>
        <summary>操作の一覧を見る</summary>
        <ul className={styles.list} aria-label="役割で決まる権限">
          {PERMISSION_ORDER.map((key) => (
            <li key={key} className={styles.grant} data-granted={permissions[key] ? '' : undefined}>
              <span>{permissionText(key).label}</span>
              <span className={styles.status} data-allowed={usable[key] ? '' : undefined} title={reasonOf(key)}>
                {!permissions[key] ? 'この役割では許可なし' : usable[key] ? '許可' : '許可（この AI では使いません）'}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </EditorSection>
  );
}
