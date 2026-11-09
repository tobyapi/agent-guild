import { Button, Dialog, FormAlert, RadioGroup } from '@/shared/ui';
import { useDataDirChange } from '../hooks/useDataDirChange';
import { changingLabel, DATA_DIR_MODE_OPTIONS } from '../model/storage';
import styles from './SettingsDialog.module.css';

export interface DataDirDialogProps {
  path: string;
  onClose: () => void;
}

/** 保存先の変更の確認: 新しい場所と、今のデータをどうするか（copy / open） */
export function DataDirDialog({ path, onClose }: DataDirDialogProps) {
  const change = useDataDirChange(path);
  const footer = (
    <>
      <Button onClick={onClose} disabled={change.busy}>
        キャンセル
      </Button>
      <Button variant="primary" onClick={() => void change.submit()} disabled={change.busy}>
        {change.busy ? changingLabel(change.mode) : '変更して再起動'}
      </Button>
    </>
  );
  return (
    <Dialog
      size="sm"
      title="データの保存先を変更"
      description="変更すると、AIギルドを再起動して新しい場所のデータで開き直します。"
      onClose={onClose}
      footer={footer}
    >
      <div className={styles.location}>
        <span className={styles.locationLabel}>新しい場所</span>
        <code className={styles.path}>{path}</code>
      </div>
      {change.error && <FormAlert>{change.error}</FormAlert>}
      <RadioGroup legend="今のデータをどうしますか" value={change.mode} options={DATA_DIR_MODE_OPTIONS} onChange={change.choose} />
    </Dialog>
  );
}
