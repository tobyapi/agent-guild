import { SkillLibrarySection } from '@/features/skills';
import { Button, Dialog, FormAlert, Icon, TextField } from '@/shared/ui';
import { useSetup } from '../hooks/useSetup';
import { t } from '../i18n';
import { tStorage } from '../i18n/storage';
import { changingLabel, storageSourceText } from '../model/storage';
import { useSettingsStore } from '../store';
import { LanguageSection } from './LanguageSection';
import { SettingsSection } from './SettingsSection';
import styles from './SettingsDialog.module.css';

/**
 * 初回起動の初期設定（docs/ui-design.md §5.11）: 言語・名前・スキルのフォルダ・データの保存先。
 * 閉じるボタンはなく、「はじめる」で終える（どれも既定のままで始められ、あとから設定で変えられる）
 */
export function SetupDialog() {
  const open = useSettingsStore((state) => state.setupOpen);
  return open ? <SetupForm /> : null;
}

function SetupForm() {
  const setup = useSetup();
  const opening = setup.dataDir !== null && setup.mode === 'open';
  const label =
    setup.busy && setup.dataDir !== null
      ? changingLabel(setup.mode)
      : opening
        ? t('setupStartWithData')
        : t('setupStart');
  const footer = (
    <Button variant="primary" onClick={() => void setup.submit()} disabled={setup.busy}>
      {label}
    </Button>
  );
  return (
    <Dialog title={t('setupTitle')} description={t('setupDescription')} footer={footer}>
      {setup.error && <FormAlert>{setup.error}</FormAlert>}
      <SettingsSection title={t('languageSection')}>
        <LanguageSection />
      </SettingsSection>
      <SettingsSection title={t('setupYourName')}>
        <TextField
          label={t('setupNameLabel')}
          value={setup.name}
          onChange={setup.updateName}
          onBlur={setup.touchName}
          error={setup.nameError}
          hint={t('setupNameHint')}
          maxLength={64}
          autoComplete="off"
          disabled={opening}
          data-autofocus
        />
      </SettingsSection>
      <SettingsSection title={t('sectionSkillLibrary')}>
        <SkillLibrarySection />
      </SettingsSection>
      <SettingsSection title={t('sectionStorage')}>
        <DataDirChoice setup={setup} />
      </SettingsSection>
    </Dialog>
  );
}

/** いまの（または選んだ）保存先と、変更・元に戻す */
function DataDirChoice({ setup }: { setup: ReturnType<typeof useSetup> }) {
  const { storage, dataDir, mode, busy } = setup;
  if (!storage) return <p className={styles.help}>{tStorage('loading')}</p>;
  const help =
    dataDir === null
      ? t('setupDataDirHelp', { source: storageSourceText(storage) })
      : mode === 'open'
        ? t('setupOpenHelp')
        : t('setupCopyHelp');
  return (
    <>
      <div className={styles.location}>
        <span className={styles.locationLabel}>{tStorage(dataDir === null ? 'currentLocation' : 'newLocation')}</span>
        <code className={styles.path}>{dataDir ?? storage.dataDir}</code>
      </div>
      <p className={styles.help}>{help}</p>
      <div>
        <Button onClick={setup.chooseDataDir} disabled={busy || storage.source === 'env'}>
          <Icon name="folder" />
          {tStorage('change')}
        </Button>
        {dataDir !== null && (
          <Button variant="ghost" onClick={setup.resetDataDir} disabled={busy}>
            {t('resetDataDir')}
          </Button>
        )}
      </div>
    </>
  );
}
