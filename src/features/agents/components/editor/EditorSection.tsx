import { useId } from 'react';
import type { ReactNode } from 'react';
import type { AgentDraft, DraftUpdate } from '../../model/draft';
import type { AgentErrors, AgentField } from '../../model/validation';
import styles from './Editor.module.css';

/** 各区画が受け取る入力と操作 */
export interface SectionProps {
  draft: AgentDraft;
  update: DraftUpdate;
  errors: AgentErrors;
  touch: (field: AgentField) => void;
}

/** 編集ダイアログの区画（小見出し＋入力） */
export function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.sectionTitle}>
        {title}
      </h3>
      {children}
    </section>
  );
}
