import { useState } from 'react';
import { Icon } from '@/shared/ui';
import { mediaHost } from '../model/mediaUrl';
import type { BodyMedia } from '../model/mediaUrl';
import styles from './BodyEmbeds.module.css';

/** この起動のあいだに「読み込む」を押した URL（同じものをもう一度聞かない） */
const approved = new Set<string>();

export interface BodyMediaViewProps {
  media: BodyMedia;
  alt: string;
  /** 画像を押したとき（大きく見る） */
  onView: (src: string, alt: string) => void;
}

/**
 * 本文の中の画像・動画。外（https）のものは、押してから読み込む（開いただけでは通信しない）。
 * 読み込めなければ、その旨と URL を文字で見せる。
 */
export function BodyMediaView({ media, alt, onView }: BodyMediaViewProps) {
  const [shown, setShown] = useState(() => !media.remote || approved.has(media.src));
  const [failed, setFailed] = useState(false);
  const label = alt || (media.kind === 'video' ? '動画' : '画像');

  if (failed) {
    return (
      <span className={styles.mediaFailed}>
        {label}を読み込めませんでした（{media.remote ? media.src : '埋め込みの画像'}）
      </span>
    );
  }
  if (!shown) {
    const show = () => {
      approved.add(media.src);
      setShown(true);
    };
    return (
      <button type="button" className={styles.mediaGate} onClick={show} title={media.src}>
        <Icon name={media.kind === 'video' ? 'play' : 'image'} className={styles.mediaIcon} />
        <span className={styles.mediaLabel}>{label}</span>
        <span className={styles.mediaHost}>{mediaHost(media.src)} から読み込む</span>
      </button>
    );
  }
  if (media.kind === 'video') {
    return (
      <video
        className={styles.video}
        src={media.src}
        controls
        preload="metadata"
        aria-label={label}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <button
      type="button"
      className={styles.mediaThumb}
      onClick={() => onView(media.src, label)}
      aria-label={`${label} を大きく表示`}
      title={label}
    >
      <img
        src={media.src}
        alt={label}
        className={styles.mediaImage}
        referrerPolicy="no-referrer"
        // 大きさを持たない SVG は、行の中の箱では幅が 0 になる。読み込めたら、画像の大きさを幅として渡す
        onLoad={(event) => event.currentTarget.setAttribute('width', String(event.currentTarget.naturalWidth))}
        onError={() => setFailed(true)}
      />
    </button>
  );
}
