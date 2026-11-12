import { useEffect, useId, useRef } from 'react';
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

const USER_MOVES = ['wheel', 'pointerdown', 'keydown'] as const;

/**
 * 開いたときに、この区画を見えるところへ出す。ほかの区画があとから読み込まれて伸びても位置を保ち、
 * 利用者が自分で動かしたら（ホイール・クリック・キー）やめる。
 */
function useScrollToSection(focused: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = ref.current;
    const container = section?.parentElement;
    if (!focused || !section || !container) return undefined;
    const show = () => section.scrollIntoView({ block: 'start' });
    show();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(show);
    for (const sibling of container.children) observer.observe(sibling);
    const stop = () => observer.disconnect();
    USER_MOVES.forEach((type) => container.addEventListener(type, stop, { once: true, passive: true }));
    return () => {
      stop();
      USER_MOVES.forEach((type) => container.removeEventListener(type, stop));
    };
  }, [focused]);
  return ref;
}

/** 設定・初期設定のダイアログの区画（小見出しつき） */
export function SettingsSection({ title, id, focus, children }: SettingsSectionProps) {
  const headingId = useId();
  const ref = useScrollToSection(id !== undefined && id === focus);
  return (
    <section ref={ref} className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.sectionTitle}>
        {title}
      </h3>
      {children}
    </section>
  );
}
