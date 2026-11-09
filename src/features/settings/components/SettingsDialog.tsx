import { useId } from 'react';
import type { ReactNode } from 'react';
import { useActiveAgents } from '@/features/agents';
import { ProfileForm } from '@/features/profile';
import { SkillLibrarySection } from '@/features/skills';
import { Button, Dialog } from '@/shared/ui';
import { closeSettings, useSettingsStore } from '../store';
import type { SettingsSection } from '../store';
import { BackendsSection } from './BackendsSection';
import { StorageSection } from './StorageSection';
import { ThemeSection } from './ThemeSection';
import styles from './SettingsDialog.module.css';

/** 設定ダイアログ: プロフィール・テーマ・バックエンド・スキルのフォルダ・データの保存先 */
export function SettingsDialog() {
  const open = useSettingsStore((state) => state.open);
  const focus = useSettingsStore((state) => state.focus);
  if (!open) return null;
  return (
    <Dialog title="設定" onClose={closeSettings} footer={<Button onClick={closeSettings}>閉じる</Button>}>
      <Section title="プロフィール">
        <ProfileSettings />
      </Section>
      <Section title="テーマ">
        <ThemeSection />
      </Section>
      <Section title="バックエンド">
        <BackendsSection />
      </Section>
      <Section title="スキルのフォルダ" id="skillLibrary" focus={focus}>
        <SkillLibrarySection />
      </Section>
      <Section title="データの保存先">
        <StorageSection />
      </Section>
    </Dialog>
  );
}

/** プロフィールの名前は、削除されていないエージェントの名前と重ならないようにする */
function ProfileSettings() {
  const agents = useActiveAgents();
  return <ProfileForm takenNames={agents.map((agent) => agent.name)} />;
}

interface SectionProps {
  title: string;
  /** focus と一致すれば、開いたときにこの区画までスクロールする */
  id?: SettingsSection;
  focus?: SettingsSection | null;
  children: ReactNode;
}

function Section({ title, id, focus, children }: SectionProps) {
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
