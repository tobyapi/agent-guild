import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/shared/lib/cx';
import { Dialog } from '@/shared/ui';
import { handleLinkClick } from '../hooks/linkClicks';
import { findEmbeds } from '../model/embeds';
import type { Embed } from '../model/embeds';
import { BodyMediaView } from './BodyMediaView';
import { CodeCopyButton } from './CodeCopyButton';
import { MermaidDiagram } from './MermaidDiagram';
import markdownStyles from './Markdown.module.css';
import codeStyles from './MarkdownCode.module.css';
import styles from './BodyEmbeds.module.css';

const NO_EMBEDS: Embed[] = [];

interface Viewing {
  src: string;
  alt: string;
}

export interface MessageBodyProps {
  content: string;
  render: (content: string) => string;
}

/**
 * 本文（Markdown をサニタイズした HTML）。リンクは OS の既定のブラウザで開く。
 * HTML の中の差し込み口（コードブロック・mermaid・画像・動画）には、React の部品をポータルで差し込む。
 */
export function MessageBody({ content, render }: MessageBodyProps) {
  const html = useMemo(() => render(content), [render, content]);
  const [embeds, setEmbeds] = useState(NO_EMBEDS);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  // HTML が変わると key で要素ごと作り直すので、そのたびに差し込み口を読み直す
  const attach = useCallback((node: HTMLDivElement | null) => {
    const found = node ? findEmbeds(node) : NO_EMBEDS;
    setEmbeds(found.length === 0 ? NO_EMBEDS : found);
  }, []);
  const view = useCallback((src: string, alt: string) => setViewing({ src, alt }), []);

  return (
    <>
      <div
        key={html}
        ref={attach}
        className={cx(markdownStyles.markdown, codeStyles.code)}
        onClick={handleLinkClick}
        onAuxClick={handleLinkClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {embeds.map((embed, index) => createPortal(<EmbedView embed={embed} onView={view} />, embed.target, index))}
      {viewing && (
        <Dialog title={viewing.alt} onClose={() => setViewing(null)} size="lg">
          <img src={viewing.src} alt={viewing.alt} className={styles.full} referrerPolicy="no-referrer" />
        </Dialog>
      )}
    </>
  );
}

function EmbedView({ embed, onView }: { embed: Embed; onView: (src: string, alt: string) => void }) {
  if (embed.kind === 'code') return <CodeCopyButton source={embed.source} />;
  if (embed.kind === 'mermaid') return <MermaidDiagram source={embed.source} host={embed.target} />;
  return <BodyMediaView media={embed.media} alt={embed.alt} onView={onView} />;
}
