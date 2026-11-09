import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** 取り消せない操作（削除など）なら true。確定ボタンが危険色になる */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 確認ダイアログ。誤操作を防ぐため、最初のフォーカスは「キャンセル」に置く */
export function ConfirmDialog({ title, message, confirmLabel, danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const footer = (
    <>
      <Button onClick={onCancel} data-autofocus>
        キャンセル
      </Button>
      <Button variant={danger ? 'dangerSolid' : 'primary'} onClick={onConfirm} disabled={busy}>
        {confirmLabel}
      </Button>
    </>
  );
  return (
    <Dialog title={title} onClose={onCancel} footer={footer} size="sm">
      <div>{message}</div>
    </Dialog>
  );
}
