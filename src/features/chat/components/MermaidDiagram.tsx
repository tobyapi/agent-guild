import { useEffect, useState } from 'react';
import { useDocumentTheme } from '../hooks/useDocumentTheme';
import { renderDiagram } from '../model/mermaid';
import type { DiagramResult } from '../model/mermaid';
import styles from './BodyEmbeds.module.css';

export interface MermaidDiagramProps {
  source: string;
  /** 差し込み先のコードブロック。図が描けたら data-rendered を付けて、ソースを畳む */
  host: Element;
}

/** ```mermaid のコードブロックを図にする。描けるまで・描けなかったときは、ソースをそのまま見せる */
export function MermaidDiagram({ source, host }: MermaidDiagramProps) {
  const theme = useDocumentTheme();
  const [result, setResult] = useState<DiagramResult | null>(null);

  useEffect(() => {
    let alive = true;
    void renderDiagram(source, theme).then((next) => {
      if (alive) setResult(next);
    });
    return () => {
      alive = false;
    };
  }, [source, theme]);

  const svg = result?.ok ? result.svg : null;
  useEffect(() => {
    host.toggleAttribute('data-rendered', svg !== null);
  }, [host, svg]);

  if (result === null) return <p className={styles.note}>図を描いています…</p>;
  if (svg === null) return <p className={styles.note}>図を描けませんでした（ソースを表示しています）</p>;
  // SVG は mermaid が securityLevel: 'strict' で作ったもの（ラベルは mermaid の中で無害化済み）
  return <div className={styles.diagram} role="img" aria-label="図" dangerouslySetInnerHTML={{ __html: svg }} />;
}
