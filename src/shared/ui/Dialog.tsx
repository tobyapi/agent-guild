import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject, SyntheticEvent } from 'react';
import { cx } from '@/shared/lib/cx';
import { IconButton } from './Button';
import { Icon } from './Icon';
import styles from './Dialog.module.css';
import { t } from './i18n';

export interface DialogProps {
  title: ReactNode;
  /** Esc・閉じるボタンで呼ばれる。親はこれを受けて Dialog を描くのをやめる。なければ閉じられない（閉じるボタンを出さず、Esc も無視する） */
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** タイトルの下の補足（aria-describedby に結びつける） */
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * モーダルダイアログ。開いている間だけ描画する（親が条件つきで描く）。
 * - ネイティブの <dialog>.showModal() でフォーカスを閉じ込め、背景を操作できなくする
 * - 開いたら data-autofocus のついた要素（なければ最初の操作要素）にフォーカスし、閉じたら元の場所へ戻す
 * - Esc で onClose（重ねて開いたダイアログは一番上だけが閉じる）
 */
export function Dialog({ title, onClose, children, footer, description, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useModal(ref);

  const handleCancel = (event: SyntheticEvent) => {
    event.preventDefault();
    onClose?.();
  };

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size])}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClose={onClose}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        {onClose && (
          <IconButton label={t('close')} onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        )}
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  );
}

/**
 * 開くときに showModal し、外れるときにフォーカスを戻す。
 * 片付けで dialog.close() は呼ばない: close イベントが非同期に届き、StrictMode の付け直しのあとに
 * onClose が呼ばれてしまうため（要素が DOM から外れれば、トップレイヤーからも自動で外れる）。
 */
function useModal(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => previous?.focus();
  }, [ref]);
}
