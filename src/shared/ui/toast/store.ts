// 通知（トースト）。どこからでも notifyInfo / reportError で出せる。
// 完了は 4 秒で消え、失敗と、操作のついた知らせは閉じるまで残る（docs/ui-design.md §5.12）。
import { create } from 'zustand';
import { errorMessage } from '@/shared/lib/errors';

export type ToastKind = 'info' | 'error';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
}

const INFO_DISPLAY_MS = 4000;
const MAX_VISIBLE = 4;
let nextId = 1;

export const useToastStore = create<ToastState>()(() => ({ toasts: [] }));

export function dismissToast(id: number): void {
  useToastStore.setState((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
}

function push(toast: Omit<Toast, 'id'>): number {
  const id = nextId++;
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-MAX_VISIBLE) }));
  return id;
}

/** 知らせる。action（「内容を見る」など）を渡したら、押すか閉じるまで残す */
export function notifyInfo(message: string, action?: ToastAction): void {
  const id = push({ kind: 'info', message, ...(action ? { action } : {}) });
  if (!action) setTimeout(() => dismissToast(id), INFO_DISPLAY_MS);
}

/** 失敗を知らせる。action を渡すと「再送信」のような操作をトーストに置ける */
export function notifyError(message: string, action?: ToastAction): void {
  push({ kind: 'error', message, ...(action ? { action } : {}) });
}

/** 失敗をエラーのトーストで知らせる（catch 節や Promise の reject ハンドラから呼ぶ） */
export function reportError(error: unknown): void {
  notifyError(errorMessage(error));
}
