import { useId } from 'react';
import type { ReactNode } from 'react';
import type { SettingsSection as SectionId } from '../store';
import styles from './SettingsDialog.module.css';

export interface SettingsSectionProps {
  title: string;
  /** focus と一致すれば、開いたときにこの区画までスクロールする */
  id?: SectionId;
  focus?: SectionId | null;
  children: ReactNode;
}

/** 設定・初期設定のダイアログの区画（小見出しつき） */
export function SettingsSection({ title, id, focus, children }: SettingsSectionProps) {
  const headingId = useId();
  const scrollIntoView = (element: HTMLElement | null) => {
    if (element && id !== undefined && id === focus) element.scrollIntoView({ block: 'start' });
  };
  return (
    <section ref={scrollIntoView} className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.sectionTitle}>
        {title}
      </h3>
      {children}
    </section>
  );
}
