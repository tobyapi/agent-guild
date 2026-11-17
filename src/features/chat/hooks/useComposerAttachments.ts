import { useCallback, useState } from 'react';
import { useStore } from 'zustand';
import type { ClipboardEvent, DragEvent } from 'react';
import { notifyError } from '@/shared/ui';
import { composerDrafts } from '../draftStore';
import {
  exceedsTotal,
  isTooLargeFile,
  rejectionMessage,
  remainingSlots,
  type PendingAttachment,
} from '../model/pendingAttachments';
import { readAttachment } from '../model/readAttachment';
import { tComposer } from '../i18n/composer';

const hasFiles = (event: DragEvent): boolean => event.dataTransfer.types.includes('Files');

/**
 * 入力欄に添えた送信前の画像・ファイル（docs/ui-design.md §5.6）: ドロップ・貼り付け・ファイル選択で足し、× で外す。
 * 数の超過・大きすぎるファイル・読めないファイルは断ってトーストで知らせる。添えた順に並べる
 */
export function useComposerAttachments(channelId: string) {
  const attachments = useStore(composerDrafts.store, () => composerDrafts.attachments(channelId));
  const [dragging, setDragging] = useState(false);

  const add = useCallback(
    (files: readonly File[]) => {
      const isCurrent = composerDrafts.beginAttachmentRead(channelId);
      const fitting = files.filter((file) => !isTooLargeFile(file));
      const accepted = fitting.slice(0, remainingSlots(attachments.length));
      const rejection = rejectionMessage({
        tooLarge: files.length - fitting.length,
        overflow: fitting.length - accepted.length,
      });
      if (rejection) notifyError(rejection);
      void Promise.allSettled(accepted.map(readAttachment)).then((results) => {
        if (!isCurrent()) return;
        const read: PendingAttachment[] = [];
        results.forEach((result, index) => {
          if (result.status === 'rejected')
            notifyError(tComposer('fileReadFailed', { name: accepted[index]?.name || tComposer('fileFallback') }));
          else read.push({ ...result.value, key: `pending-${crypto.randomUUID()}` });
        });
        if (exceedsTotal(composerDrafts.attachments(channelId), read)) {
          notifyError(tComposer('totalTooLarge'));
          return;
        }
        composerDrafts.setAttachments(channelId, (current) => [
          ...current,
          ...read.slice(0, remainingSlots(current.length)),
        ]);
      });
    },
    [attachments, channelId],
  );

  const remove = useCallback(
    (key: string) => composerDrafts.setAttachments(channelId, (current) => current.filter((item) => item.key !== key)),
    [channelId],
  );
  const clear = useCallback(() => composerDrafts.clearAttachments(channelId), [channelId]);

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
