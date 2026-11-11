import { useState } from 'react';
import { Dialog, Icon, reportError } from '@/shared/ui';
import type { Attachment, Message } from '@/shared/types/domain';
import { revealAttachment } from '../attachmentStore';
import { useAttachmentSrc } from '../hooks/useAttachmentSrc';
import { isVideoType } from '../model/mediaUrl';
import { isImageType, sizeLabel } from '../model/pendingAttachments';
import { AttachmentVideo } from './AttachmentVideo';
import styles from './MessageAttachments.module.css';

/**
 * 発言に添えられたもの（docs/ui-design.md §5.4）: 画像はサムネイル（押すと大きく見る）、動画は欄の中で再生、
 * ファイルは名前と大きさの札（押すとファイラでそのファイルを表示する）
 */
export function MessageAttachments({ message }: { message: Message }) {
  if (message.attachments.length === 0) return null;
  const images = message.attachments.filter((attachment) => isImageType(attachment.mediaType));
  const videos = message.attachments.filter((attachment) => isVideoType(attachment.mediaType));
  const files = message.attachments.filter(({ mediaType }) => !isImageType(mediaType) && !isVideoType(mediaType));
  return (
    <div className={styles.attachments}>
      {images.length > 0 && (
        <div className={styles.images}>
          {images.map((attachment) => (
            <MessageImage key={attachment.id} messageId={message.id} attachment={attachment} />
          ))}
        </div>
      )}
      {videos.map((attachment) => (
        <AttachmentVideo key={attachment.id} messageId={message.id} attachment={attachment} />
      ))}
      {files.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          className={styles.file}
          onClick={() => void revealAttachment(message.id, attachment.id).catch(reportError)}
          title={`${attachment.name} をフォルダで表示`}
        >
          <Icon name="file" className={styles.fileIcon} />
          <span className={styles.fileName}>{attachment.name}</span>
          <span className={styles.fileSize}>{sizeLabel(attachment.size)}</span>
        </button>
      ))}
    </div>
  );
}

function MessageImage({ messageId, attachment }: { messageId: string; attachment: Attachment }) {
  const { src, failed } = useAttachmentSrc(messageId, attachment.id);
  const [open, setOpen] = useState(false);
  if (failed) return <span className={styles.failed}>画像を読み込めませんでした（{attachment.name}）</span>;
  return (
    <>
      <button
        type="button"
        className={styles.thumb}
        onClick={() => setOpen(true)}
        disabled={src === null}
        aria-label={`${attachment.name} を大きく表示`}
        title={attachment.name}
      >
        {src ? <img src={src} alt={attachment.name} className={styles.image} /> : <span className={styles.loading} />}
      </button>
      {open && src && (
        <Dialog title={attachment.name} onClose={() => setOpen(false)} size="lg">
          <img src={src} alt={attachment.name} className={styles.full} />
        </Dialog>
      )}
    </>
  );
}
