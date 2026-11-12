import { Icon, IconButton } from '@/shared/ui';
import { sizeLabel, type PendingAttachment } from '../model/pendingAttachments';
import { tComposer } from '../i18n/composer';
import styles from './PendingAttachments.module.css';

export interface PendingAttachmentsProps {
  attachments: readonly PendingAttachment[];
  onRemove: (key: string) => void;
}

/** 入力欄の上に並べる送信前の添付: 画像はサムネイル、ファイルは名前と大きさの札（× で外す。docs/ui-design.md §5.6） */
export function PendingAttachments({ attachments, onRemove }: PendingAttachmentsProps) {
  if (attachments.length === 0) return null;
  return (
    <ul className={styles.list} aria-label={tComposer('pendingLabel')}>
      {attachments.map((attachment) => (
        <li key={attachment.key} className={styles.item}>
          {attachment.preview === null ? (
            <span className={styles.file} title={attachment.name}>
              <Icon name="file" className={styles.fileIcon} />
              <span className={styles.fileName}>{attachment.name}</span>
              <span className={styles.fileSize}>{sizeLabel(attachment.size)}</span>
            </span>
          ) : (
            <img className={styles.thumb} src={attachment.preview} alt={attachment.name} title={attachment.name} />
          )}
          <IconButton
            label={tComposer('removeAttachment', { name: attachment.name })}
            className={styles.remove}
            onClick={() => onRemove(attachment.key)}
          >
            <Icon name="close" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}
