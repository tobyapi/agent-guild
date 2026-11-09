import { useCallback, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { notifyError } from '@/shared/ui';
import {
  exceedsTotal,
  isTooLargeFile,
  rejectionMessage,
  remainingSlots,
  TOTAL_TOO_LARGE,
  type PendingAttachment,
} from '../model/pendingAttachments';
import { readAttachment } from '../model/readAttachment';

const hasFiles = (event: DragEvent): boolean => event.dataTransfer.types.includes('Files');

/**
 * 入力欄に添えた送信前の画像・ファイル（docs/ui-design.md §5.6）: ドロップ・貼り付け・ファイル選択で足し、× で外す。
 * 数の超過・大きすぎるファイル・読めないファイルは断ってトーストで知らせる。添えた順に並べる
 */
export function useComposerAttachments() {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);

  const add = useCallback(
    (files: readonly File[]) => {
      const fitting = files.filter((file) => !isTooLargeFile(file));
      const accepted = fitting.slice(0, remainingSlots(attachments.length));
      const rejection = rejectionMessage({ tooLarge: files.length - fitting.length, overflow: fitting.length - accepted.length });
      if (rejection) notifyError(rejection);
      void Promise.allSettled(accepted.map(readAttachment)).then((results) => {
        const read: PendingAttachment[] = [];
        results.forEach((result, index) => {
          if (result.status === 'rejected') notifyError(`${accepted[index]?.name || 'ファイル'} を読み込めませんでした`);
          else read.push({ ...result.value, key: `pending-${(counter.current += 1)}` });
        });
        if (exceedsTotal(attachments, read)) {
          notifyError(TOTAL_TOO_LARGE);
          return;
        }
        setAttachments((current) => [...current, ...read.slice(0, remainingSlots(current.length))]);
      });
    },
    [attachments],
  );

  const remove = useCallback((key: string) => setAttachments((current) => current.filter((item) => item.key !== key)), []);
  const clear = useCallback(() => setAttachments([]), []);

  /** ファイルを含む貼り付けだけ横取りする（文字の貼り付けはそのまま） */
  const onPaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) return;
    event.preventDefault();
    add(files);
  };

  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (event: DragEvent) => {
    // 枠の中の部品に移っただけなら、ドラッグ中のまま
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    setDragging(false);
    if (!hasFiles(event)) return;
    event.preventDefault();
    add(Array.from(event.dataTransfer.files));
  };

  return { attachments, dragging, add, remove, clear, onPaste, onDragOver, onDragLeave, onDrop };
}

export type ComposerAttachments = ReturnType<typeof useComposerAttachments>;
