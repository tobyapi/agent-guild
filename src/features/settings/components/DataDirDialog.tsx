import { Button, Dialog, FormAlert, RadioGroup } from '@/shared/ui';
import { useDataDirChange } from '../hooks/useDataDirChange';
import { tStorage as t } from '../i18n/storage';
import { changingLabel, dataDirModeOptions } from '../model/storage';
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
        {t('cancel')}
      </Button>
      <Button variant="primary" onClick={() => void change.submit()} disabled={change.busy}>
        {change.busy ? changingLabel(change.mode) : t('changeAndRestart')}
      </Button>
    </>
  );
  return (
    <Dialog size="sm" title={t('dialogTitle')} description={t('dialogDescription')} onClose={onClose} footer={footer}>
      <div className={styles.location}>
        <span className={styles.locationLabel}>{t('newLocation')}</span>
        <code className={styles.path}>{path}</code>
      </div>
      {change.error && <FormAlert>{change.error}</FormAlert>}
      <RadioGroup
        legend={t('dialogLegend')}
        value={change.mode}
        options={dataDirModeOptions()}
        onChange={change.choose}
      />
    </Dialog>
  );
}
