import { useEffect, useMemo, useState } from 'react';
import { Dialog, Icon, reportError } from '@/shared/ui';
import { chatApi, type LocalImage } from '../api';
import type { LocalImagePath } from '../model/localImagePaths';
import { t } from '../i18n';
import styles from './LocalImageView.module.css';

export interface LocalImageViewProps {
  image: LocalImagePath;
  agentId: string | null;
}

function pathName(path: string): string {
  return path.split(/[\\/]/).at(-1) || path;
}

/** 本文に書かれたローカル画像。パスの札、検査結果、サムネイルを一組で表示する。 */
export function LocalImageView({ image, agentId }: LocalImageViewProps) {
  const [result, setResult] = useState<LocalImage | null>(null);
  const [open, setOpen] = useState(false);
  const label = image.alt || pathName(image.path);
  const src = useMemo(() => (result?.status === 'ok' ? `data:${result.mime};base64,${result.base64}` : null), [result]);

  useEffect(() => {
    let active = true;
    void chatApi
      .localImage(image.path, agentId)
      .then((next) => {
        if (active) setResult(next);
      })
      .catch((error: unknown) => {
        if (active) setResult({ status: 'unsupported' });
        reportError(error);
      });
    return () => {
      active = false;
    };
  }, [image.path, agentId]);

  return (
    <div className={styles.item}>
      <button
        type="button"
        className={styles.path}
        onClick={() => void chatApi.revealLocalFile(image.path, agentId).catch(reportError)}
        title={t('revealLocalImage', { path: image.path })}
      >
        <Icon name="image" className={styles.icon} />
        <span>{image.path}</span>
      </button>
      {result === null && <span className={styles.status}>{t('localImageLoading')}</span>}
      {result?.status === 'notFound' && <span className={styles.status}>{t('localImageNotFound')}</span>}
      {result?.status === 'unsupported' && <span className={styles.status}>{t('localImageUnsupported')}</span>}
      {src && (
        <button
          type="button"
          className={styles.thumb}
          onClick={() => setOpen(true)}
          aria-label={t('viewLarger', { name: label })}
          title={label}
        >
          <img src={src} alt={label} className={styles.image} />
        </button>
      )}
      {open && src && (
        <Dialog title={label} onClose={() => setOpen(false)} size="lg">
          <img src={src} alt={label} className={styles.full} />
        </Dialog>
      )}
    </div>
  );
}
