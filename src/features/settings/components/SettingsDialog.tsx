import { useActiveAgents } from '@/features/agents';
import { ProfileForm } from '@/features/profile';
import { SkillLibrarySection } from '@/features/skills';
import { UpdateSection } from '@/features/update';
import { Button, Dialog } from '@/shared/ui';
import { t } from '../i18n';
import { closeSettings, useSettingsStore } from '../store';
import { BackendsSection } from './BackendsSection';
import { LanguageSection } from './LanguageSection';
import { SettingsSection as Section } from './SettingsSection';
import { StorageSection } from './StorageSection';
import { ThemeSection } from './ThemeSection';

/** 設定ダイアログ: プロフィール・言語・テーマ・バックエンド・スキルのフォルダ・データの保存先・アプリの更新 */
export function SettingsDialog() {
  const open = useSettingsStore((state) => state.open);
  const focus = useSettingsStore((state) => state.focus);
  if (!open) return null;
  return (
    <Dialog
      title={t('settingsTitle')}
      onClose={closeSettings}
      footer={<Button onClick={closeSettings}>{t('close')}</Button>}
    >
      <Section title={t('sectionProfile')}>
        <ProfileSettings />
      </Section>
      <Section title={t('languageSection')}>
        <LanguageSection />
      </Section>
      <Section title={t('sectionTheme')}>
        <ThemeSection />
      </Section>
      <Section title={t('sectionBackends')}>
        <BackendsSection />
      </Section>
      <Section title={t('sectionSkillLibrary')} id="skillLibrary" focus={focus}>
        <SkillLibrarySection />
      </Section>
      <Section title={t('sectionStorage')}>
        <StorageSection />
      </Section>
      <Section title={t('sectionUpdate')} id="update" focus={focus}>
        <UpdateSection />
      </Section>
    </Dialog>
  );
}

/** プロフィールの名前は、削除されていないエージェントの名前と重ならないようにする */
function ProfileSettings() {
  const agents = useActiveAgents();
  return <ProfileForm takenNames={agents.map((agent) => agent.name)} />;
}
