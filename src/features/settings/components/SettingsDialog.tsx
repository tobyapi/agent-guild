import { useActiveAgents } from '@/features/agents';
import { ProfileForm } from '@/features/profile';
import { SkillLibrarySection } from '@/features/skills';
import { Button, Dialog } from '@/shared/ui';
import { closeSettings, useSettingsStore } from '../store';
import { BackendsSection } from './BackendsSection';
import { SettingsSection as Section } from './SettingsSection';
import { StorageSection } from './StorageSection';
import { ThemeSection } from './ThemeSection';

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
