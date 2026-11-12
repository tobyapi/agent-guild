import { useEffect, useRef } from 'react';
import { cx } from '@/shared/lib/cx';
import { Button, IconButton } from '../Button';
import { Icon } from '../Icon';
import { dismissToast, useToastStore } from './store';
import type { Toast } from './store';
import styles from './ToastViewport.module.css';
import { t } from '../i18n';

/**
 * トーストの置き場所。popover としてトップレイヤーに出すので、モーダルダイアログを開いていても手前に見える。
 * アプリに1つだけ置く。
 */
export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) bringToFront(ref.current, toasts.length > 0);
  }, [toasts]);

  return (
    <div ref={ref} popover="manual" className={styles.viewport} aria-label={t('notifications')}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const isError = toast.kind === 'error';
  const runAction = () => {
    dismissToast(toast.id);
    toast.action?.run();
  };
  return (
    <div className={cx(styles.toast, styles[toast.kind])} role={isError ? 'alert' : 'status'}>
      <Icon name={isError ? 'alert' : 'check'} className={styles.mark} />
      <p className={styles.message}>{toast.message}</p>
      {toast.action && (
        <Button size="sm" variant="ghost" onClick={runAction}>
          {toast.action.label}
        </Button>
      )}
      <IconButton label={t('dismissNotification')} onClick={() => dismissToast(toast.id)}>
        <Icon name="close" />
      </IconButton>
    </div>
  );
}

/** トップレイヤーの一番上へ出し直す（後から開いたダイアログより手前にするため） */
function bringToFront(element: HTMLElement, visible: boolean): void {
  // Popover API のない古い WebView では何もしない（通常の重なり順で表示される）
  if (!('showPopover' in element)) return;
  if (element.matches(':popover-open')) element.hidePopover();
  if (visible) element.showPopover();
}
