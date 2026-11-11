import { useState } from 'react';
import { Icon, reportError } from '@/shared/ui';
import type { Attachment } from '@/shared/types/domain';
import { fetchAttachment, revealAttachment } from '../attachmentStore';
import { sizeLabel } from '../model/pendingAttachments';
import styles from './AttachmentVideo.module.css';

type Playback = { state: 'idle' | 'loading' | 'failed' } | { state: 'ready'; src: string };

/**
 * 発言に添えた動画。中身は大きいので、再生を押してから取りに行く（一覧を開いただけでは読み込まない）。
 * WebView が再生できない形式なら、その旨を出す。どちらの場合も、名前からフォルダで表示できる。
 */
export function AttachmentVideo({ messageId, attachment }: { messageId: string; attachment: Attachment }) {
  const [playback, setPlayback] = useState<Playback>({ state: 'idle' });
  const fail = () => setPlayback({ state: 'failed' });
  const load = () => {
    setPlayback({ state: 'loading' });
    fetchAttachment(messageId, attachment.id).then((src) => setPlayback({ state: 'ready', src }), fail);
  };

  return (
    <figure className={styles.video}>
      {playback.state === 'ready' ? (
        <video
          className={styles.player}
          src={playback.src}
          controls
          autoPlay
          aria-label={attachment.name}
          onError={fail}
        />
      ) : (
        <button
          type="button"
          className={styles.poster}
          onClick={load}
          disabled={playback.state !== 'idle'}
          aria-label={`${attachment.name} を再生`}
        >
          {playback.state === 'failed' ? (
            <span className={styles.failed}>この動画は再生できませんでした</span>
          ) : (
            <Icon name="play" className={styles.play} />
          )}
        </button>
      )}
      <figcaption className={styles.caption}>
        <button
          type="button"
          className={styles.name}
          onClick={() => void revealAttachment(messageId, attachment.id).catch(reportError)}
          title={`${attachment.name} をフォルダで表示`}
        >
          {attachment.name}
        </button>
        <span className={styles.size}>{sizeLabel(attachment.size)}</span>
      </figcaption>
    </figure>
  );
}
