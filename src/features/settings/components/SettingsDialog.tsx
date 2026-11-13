import { useId, useState } from 'react';
import { useActiveAgents } from '@/features/agents';
import { GuildForm, guildSectionTitle } from '@/features/guild';
import { ProfileForm } from '@/features/profile';
import { SkillLibrarySection } from '@/features/skills';
import { SoundSection, soundSectionTitle } from '@/features/sounds';
import { UpdateSection } from '@/features/update';
import { Button, Dialog } from '@/shared/ui';
import { t } from '../i18n';
import { tAppearance } from '../i18n/appearance';
import { closeSettings, useSettingsStore } from '../store';
import { AppearanceSection } from './AppearanceSection';
import { BackendsSection } from './BackendsSection';
import { LanguageSection } from './LanguageSection';
import { SettingsSection as Section } from './SettingsSection';
import { StorageSection } from './StorageSection';
import styles from './SettingsDialog.module.css';

const groups = ['personal', 'display', 'ai', 'app'] as const;
type Group = (typeof groups)[number];
const groupLabels = { personal: 'groupPersonal', display: 'groupDisplay', ai: 'groupAi', app: 'groupApp' } as const;

/** 設定ダイアログ: ギルド・プロフィール・言語・外観・通知・バックエンド・スキルのフォルダ・データの保存先・アプリの更新 */
export function SettingsDialog() {
  const open = useSettingsStore((state) => state.open);
  const focus = useSettingsStore((state) => state.focus);
  if (!open) return null;
  return <SettingsContent key={focus ?? 'default'} focus={focus} />;
}

function SettingsContent({ focus }: { focus: 'skillLibrary' | 'update' | null }) {
  const [selected, setSelected] = useState<Group>(
    focus === 'skillLibrary' ? 'ai' : focus === 'update' ? 'app' : 'personal',
  );
  const id = useId();
  return (
    <Dialog
      title={t('settingsTitle')}
      size="lg"
      onClose={closeSettings}
      footer={<Button onClick={closeSettings}>{t('close')}</Button>}
    >
      <div className={styles.layout}>
        <GroupNavigation selected={selected} onSelect={setSelected} id={id} />
        {groups.map((group) => (
          <div
            key={group}
            role="tabpanel"
            id={`${id}-${group}-panel`}
            aria-labelledby={`${id}-${group}-tab`}
            hidden={selected !== group}
            tabIndex={0}
            className={styles.panel}
          >
            {group === 'personal' && (
              <>
                <Section title={guildSectionTitle()}>
                  <GuildForm />
                </Section>
                <Section title={t('sectionProfile')}>
                  <ProfileSettings />
                </Section>
              </>
            )}
            {group === 'display' && (
              <>
                <Section title={t('languageSection')}>
                  <LanguageSection />
                </Section>
                <Section title={tAppearance('sectionTitle')}>
                  <AppearanceSection />
                </Section>
                <Section title={soundSectionTitle()}>
                  <SoundSection />
                </Section>
              </>
            )}
            {group === 'ai' && (
              <>
                <Section title={t('sectionBackends')}>
                  <BackendsSection />
                </Section>
                <Section title={t('sectionSkillLibrary')} id="skillLibrary" focus={selected === group ? focus : null}>
                  <SkillLibrarySection />
                </Section>
              </>
            )}
            {group === 'app' && (
              <>
                <Section title={t('sectionStorage')}>
                  <StorageSection />
                </Section>
                <Section title={t('sectionUpdate')} id="update" focus={selected === group ? focus : null}>
                  <UpdateSection />
                </Section>
              </>
            )}
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/** プロフィールの名前は、削除されていないエージェントの名前と重ならないようにする */
function ProfileSettings() {
  const agents = useActiveAgents();
  return <ProfileForm takenNames={agents.map((agent) => agent.name)} />;
}

function GroupNavigation({
  selected,
  onSelect,
  id,
}: {
  selected: Group;
  onSelect: (group: Group) => void;
  id: string;
}) {
  return (
    <div className={styles.navigation} role="tablist" aria-label={t('settingsTitle')} aria-orientation="vertical">
      {groups.map((group, index) => (
        <button
          key={group}
          type="button"
          role="tab"
          id={`${id}-${group}-tab`}
          aria-controls={`${id}-${group}-panel`}
          aria-selected={selected === group}
          tabIndex={selected === group ? 0 : -1}
          data-autofocus={selected === group ? '' : undefined}
          className={styles.tab}
          onClick={() => onSelect(group)}
          onKeyDown={(event) => {
            let next: number;
            if (event.key === 'ArrowDown') next = (index + 1) % groups.length;
            else if (event.key === 'ArrowUp') next = (index + groups.length - 1) % groups.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = groups.length - 1;
            else return;
            event.preventDefault();
            const nextGroup = groups[next];
            if (!nextGroup) return;
            onSelect(nextGroup);
            document.getElementById(`${id}-${nextGroup}-tab`)?.focus();
          }}
        >
          {t(groupLabels[group])}
        </button>
      ))}
    </div>
  );
}
