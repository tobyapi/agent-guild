import { SkillLibrarySection } from '@/features/skills';
import { Button, Dialog, FormAlert, Icon, TextField } from '@/shared/ui';
import { useSetup } from '../hooks/useSetup';
import { changingLabel, storageSourceText } from '../model/storage';
import { useSettingsStore } from '../store';
import { SettingsSection } from './SettingsSection';
import styles from './SettingsDialog.module.css';

/**
 * 初回起動の初期設定（docs/ui-design.md §5.11）: 名前・スキルのフォルダ・データの保存先。
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
    setup.busy && setup.dataDir !== null ? changingLabel(setup.mode) : opening ? 'そのデータではじめる' : 'はじめる';
  const footer = (
    <Button variant="primary" onClick={() => void setup.submit()} disabled={setup.busy}>
      {label}
    </Button>
  );
  return (
    <Dialog
      title="AIギルドへようこそ"
      description="はじめに3つ決めてください。どれもあとから設定で変えられます。"
      footer={footer}
    >
      {setup.error && <FormAlert>{setup.error}</FormAlert>}
      <SettingsSection title="あなたの名前">
        <TextField
          label="名前"
          value={setup.name}
          onChange={setup.updateName}
          onBlur={setup.touchName}
          error={setup.nameError}
          hint="エージェントがあなたを呼ぶときの名前です。"
          maxLength={64}
          autoComplete="off"
          disabled={opening}
          data-autofocus
        />
      </SettingsSection>
      <SettingsSection title="スキルのフォルダ">
        <SkillLibrarySection />
      </SettingsSection>
      <SettingsSection title="データの保存先">
        <DataDirChoice setup={setup} />
      </SettingsSection>
    </Dialog>
  );
}

/** いまの（または選んだ）保存先と、変更・元に戻す */
function DataDirChoice({ setup }: { setup: ReturnType<typeof useSetup> }) {
  const { storage, dataDir, mode, busy } = setup;
  if (!storage) return <p className={styles.help}>読み込み中…</p>;
  const help =
    dataDir === null
      ? `チャンネル・エージェント・会話を保存する場所です。${storageSourceText(storage)}`
      : mode === 'open'
        ? 'このフォルダにあるギルドのデータではじめます。名前やエージェントは、そのデータのものになります。'
        : 'いまのデータをこのフォルダにコピーして使います（はじめる と再起動します）。';
  return (
    <>
      <div className={styles.location}>
        <span className={styles.locationLabel}>{dataDir === null ? 'いまの場所' : '新しい場所'}</span>
        <code className={styles.path}>{dataDir ?? storage.dataDir}</code>
      </div>
      <p className={styles.help}>{help}</p>
      <div>
        <Button onClick={setup.chooseDataDir} disabled={busy || storage.source === 'env'}>
          <Icon name="folder" />
          変更…
        </Button>
        {dataDir !== null && (
          <Button variant="ghost" onClick={setup.resetDataDir} disabled={busy}>
            元に戻す
          </Button>
        )}
      </div>
    </>
  );
}
