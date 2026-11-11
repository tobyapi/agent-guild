import { useBackend } from '@/features/runtime';
import { permissionRole, rolePermissions } from '@/shared/lib/permissionPolicy';
import { Icon } from '@/shared/ui';
import type { Permissions } from '@/shared/types/domain';
import { useTemplates } from '../../hooks/useAgents';
import { PERMISSION_ORDER, permissionText } from '../../model/permissions';
import { EditorSection } from './EditorSection';
import styles from './PermissionFields.module.css';

export interface PermissionFieldsProps {
  backendId: string;
  tags: readonly string[];
  permissions: Permissions;
  error?: string;
}

/** 役割の固定設定を説明する。個別の権限スイッチや、依存関係を利用者に解かせる表示は置かない。 */
export function PermissionFields({ backendId, tags, permissions, error }: PermissionFieldsProps) {
  const backend = useBackend(backendId);
  const templates = useTemplates();
  const role = permissionRole(templates, tags);
  const requested = rolePermissions(templates, tags);
  const available = PERMISSION_ORDER.filter((key) => permissions[key]);
  const restricted = PERMISSION_ORDER.filter((key) => requested[key] && !permissions[key]);
  return (
    <EditorSection title="できること">
      <p>
        {role
          ? `${role.label}の固定設定です。役割を変えると、自動で切り替わります。`
          : '役割が未設定のため、参照とスキルだけに制限しています。上のカードで役割を選べます。'}
      </p>
      <p className={styles.description}>
        {available.length > 0
          ? `利用できる機能：${available.map((key) => permissionText(key).label).join('・')}`
          : 'このバックエンドでは会話による回答ができます。ファイル操作などのツールは使えません。'}
      </p>
      {restricted.length > 0 && backend && (
        <p className={styles.description} role="note">
          {backend.label}では、この役割の許可範囲で使えない機能（
          {restricted.map((key) => permissionText(key).label).join('・')}）を自動で無効にしています。
        </p>
      )}
      {!backend && <p className={styles.description}>バックエンドの準備ができると、利用できる機能を確認します。</p>}
      {permissions.readAnywhere && !permissions.writeAnywhere && (
        <p className={styles.notice} role="note">
          作業フォルダの外も読めます。秘密鍵や .env を除外する仕組みはありません。書き込みは作業フォルダ内だけです。
        </p>
      )}
      {permissions.writeAnywhere && (
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
        <summary>機能の一覧を見る</summary>
        <ul className={styles.list} aria-label="役割で決まる権限">
          {PERMISSION_ORDER.map((key) => (
            <li key={key} className={styles.grant}>
              <span>{permissionText(key).label}</span>
              <span className={styles.status} data-allowed={permissions[key] ? '' : undefined}>
                {permissions[key] ? '利用可' : requested[key] ? 'このバックエンドでは利用不可' : 'この役割では利用不可'}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </EditorSection>
  );
}
