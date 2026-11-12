import { useEffect, useState } from 'react';
import { Icon, reportError } from '@/shared/ui';
import { t } from '../i18n';
import styles from './BodyEmbeds.module.css';

const COPIED_MS = 2000;

/** コードブロックの見出しに差し込むコピーのボタン（押すと2秒だけ「コピーしました」） */
export function CodeCopyButton({ source }: { source: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    navigator.clipboard.writeText(source).then(() => setCopied(true), reportError);
  };

  return (
    <button type="button" className={styles.copy} onClick={copy} data-copied={copied ? '' : undefined}>
      {copied && <Icon name="check" />}
      <span aria-live="polite">{t(copied ? 'copied' : 'copy')}</span>
    </button>
  );
}
