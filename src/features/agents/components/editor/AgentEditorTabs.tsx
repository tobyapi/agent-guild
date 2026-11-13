import type { ReactNode } from 'react';
import { tEditor } from '../../i18n/editor';
import styles from './AgentEditorTabs.module.css';

export const EDITOR_TABS = ['basics', 'persona', 'behavior', 'brain', 'skills'] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

const labels: Record<EditorTab, Parameters<typeof tEditor>[0]> = {
  basics: 'tabBasics',
  persona: 'tabPersona',
  behavior: 'tabBehavior',
  brain: 'tabBrain',
  skills: 'tabSkills',
};

export function AgentEditorTabs({
  errorTabs,
  showSkills,
  tabsLabel,
  selected,
  onSelect,
  id,
}: {
  errorTabs: readonly EditorTab[];
  showSkills: boolean;
  tabsLabel: string;
  selected: EditorTab;
  onSelect: (tab: EditorTab) => void;
  id: string;
}) {
  const tabs = showSkills ? EDITOR_TABS : EDITOR_TABS.filter((tab) => tab !== 'skills');
  return (
    <div className={styles.tablist} role="tablist" aria-label={tabsLabel}>
      {tabs.map((tab, index) => {
        const hasError = errorTabs.includes(tab);
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${id}-${tab}-tab`}
            aria-controls={`${id}-${tab}-panel`}
            aria-selected={selected === tab}
            tabIndex={selected === tab ? 0 : -1}
            className={styles.tab}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = tabs.length - 1;
              else return;
              event.preventDefault();
              const nextTab = tabs[next];
              if (!nextTab) return;
              onSelect(nextTab);
              document.getElementById(`${id}-${nextTab}-tab`)?.focus();
            }}
          >
            {tEditor(labels[tab])}
            {hasError && <span className={styles.errorDot} aria-hidden="true" />}
            {hasError && <span className={styles.srOnly}>{tEditor('tabHasErrors')}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AgentEditorPanel({
  id,
  tab,
  selected,
  children,
}: {
  id: string;
  tab: EditorTab;
  selected: EditorTab;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${id}-${tab}-panel`}
      aria-labelledby={`${id}-${tab}-tab`}
      hidden={selected !== tab}
      tabIndex={0}
      className={styles.panel}
    >
      {children}
    </div>
  );
}
