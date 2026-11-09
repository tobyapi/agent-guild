import { useEffect, useState } from 'react';
import { cachedAttachment, loadAttachment } from '../attachmentStore';

export interface AttachmentSrc {
  /** 取得できた data URL（取得中・失敗は null） */
  src: string | null;
  failed: boolean;
}

/** 発言に貼られた画像の data URL。取得済みならすぐ返し、なければ取りに行く */
export function useAttachmentSrc(messageId: string, attachmentId: string): AttachmentSrc {
  const [state, setState] = useState<AttachmentSrc>(() => ({
    src: cachedAttachment(attachmentId) ?? null,
    failed: false,
  }));
  const needsLoad = state.src === null && !state.failed;

  useEffect(() => {
    if (!needsLoad) return undefined;
    let alive = true;
    loadAttachment(messageId, attachmentId).then(
      (src) => {
        if (alive) setState({ src, failed: false });
      },
      () => {
        if (alive) setState({ src: null, failed: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [messageId, attachmentId, needsLoad]);

  return state;
}
