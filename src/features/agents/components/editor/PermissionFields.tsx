import { useId } from 'react';
import { useBackend } from '@/features/runtime';
import { Icon, Switch } from '@/shared/ui';
import type { PermissionKey, Permissions } from '@/shared/types/domain';
import { PERMISSION_ORDER, permissionRuleProblem, permissionText } from '../../model/permissions';
import { EditorSection } from './EditorSection';
import styles from './PermissionFields.module.css';

export interface PermissionFieldsProps {
  backendId: string;
  permissions: Permissions;
  /** 保存で返った権限の問題（入力を変えるまで出す） */
  error?: string;
  onToggle: (key: PermissionKey, on: boolean) => void;
}

/** できること: 権限のトグル（docs/ui-design.md §6.3）。バックエンドの権限の規則に反していれば先に知らせる */
export function PermissionFields({ backendId, permissions, error, onToggle }: PermissionFieldsProps) {
  const backend = useBackend(backendId);
  // 規則に反していれば保存する前から知らせる（保存も validation で止まる）。backend の問題は頭脳の区画に出る
  const rule = permissionRuleProblem(backend, permissions);
  const notice = rule?.field === 'permissions' ? rule.message : error;
  return (
    <EditorSection title="できること">
      {notice && (
        <p className={styles.notice} role="note">
          <Icon name="alert" className={styles.warningIcon} />
          {notice}
        </p>
      )}
      <ul className={styles.list}>
        {PERMISSION_ORDER.map((key) => (
          <PermissionToggle
            key={key}
            permission={key}
            on={permissions[key]}
            supported={backend?.capabilities[key] ?? true}
            onChange={(on) => onToggle(key, on)}
          />
        ))}
      </ul>
    </EditorSection>
  );
}

interface PermissionToggleProps {
  permission: PermissionKey;
  on: boolean;
  supported: boolean;
  onChange: (on: boolean) => void;
}

/** 権限の行。注意書きのある権限はオンにすると行全体が注意の姿になる。バックエンドが使えない権限はオフで固定 */
function PermissionToggle({ permission, on, supported, onChange }: PermissionToggleProps) {
  const id = useId();
  const text = permissionText(permission);
  const risky = text.warning !== '';
  const active = on && supported;
  const showWarning = active && risky;
  const describedBy = [`${id}-description`, showWarning ? `${id}-warning` : null].filter(Boolean).join(' ');
  return (
    <li className={styles.grant} data-on={active ? '' : undefined} data-risky={risky ? '' : undefined}>
      <b id={`${id}-label`} className={styles.grantLabel} data-off={supported ? undefined : ''}>
        {text.label}
      </b>
      <p id={`${id}-description`} className={styles.grantDescription}>
        {supported ? text.description : 'このバックエンドでは使えません。'}
      </p>
      <div className={styles.grantSwitch}>
        <Switch
          checked={active}
          onChange={onChange}
          labelledBy={`${id}-label`}
          describedBy={describedBy}
          disabled={!supported}
          tone={risky ? 'warning' : 'accent'}
        />
      </div>
      {showWarning && (
        <p id={`${id}-warning`} className={styles.warning}>
          <Icon name="alert" className={styles.warningIcon} />
          {text.warning}
        </p>
      )}
    </li>
  );
}
