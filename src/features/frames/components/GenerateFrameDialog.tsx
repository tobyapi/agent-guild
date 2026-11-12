import { FRAME_DESCRIPTION_MAX } from '@/shared/lib/frames';
import { Button, Dialog, FormAlert, TextAreaField, TextField } from '@/shared/ui';
import { useFrameGeneration } from '../hooks/useFrameGeneration';
import { t } from '../i18n';
import styles from './GenerateFrameDialog.module.css';

export interface GenerateFrameDialogProps {
  onClose: () => void;
  /** 生成して保存した枠の ID（選んだ状態にする） */
  onGenerated: (frameId: string) => void;
}

const FORM_ID = 'generate-avatar-frame';

/** 題材を書いて枠を生成する。描くのは、枠の生成を申告していて status が ready のバックエンド（選ばせない） */
export function GenerateFrameDialog({ onClose, onGenerated }: GenerateFrameDialogProps) {
  const form = useFrameGeneration(onClose, onGenerated);
  const { pending, problems } = form;
  const footer = (
    <>
      <Button onClick={form.close}>{pending ? t('stop') : t('cancel')}</Button>
      <Button variant="primary" type="submit" form={FORM_ID} disabled={pending || form.backend === null}>
        {t('submit')}
      </Button>
    </>
  );
  return (
    <Dialog
      title={t('dialogTitle')}
      description={t('dialogDescription')}
      onClose={form.close}
      footer={footer}
      size="sm"
    >
      <form id={FORM_ID} className={styles.form} onSubmit={form.submit} aria-busy={pending} noValidate>
        {problems.form && <FormAlert>{problems.form}</FormAlert>}
        <TextAreaField
          label={t('description')}
          hint={t('descriptionHint')}
          placeholder={t('descriptionPlaceholder')}
          value={form.description}
          onChange={form.setDescription}
          error={problems.description}
          maxLength={FRAME_DESCRIPTION_MAX * 2}
          rows={3}
          disabled={pending}
          data-autofocus
        />
        <TextField
          label={t('name')}
          hint={t('nameHint')}
          value={form.name}
          onChange={form.setName}
          optional
          disabled={pending}
        />
        {form.backend === null ? (
          <FormAlert>{t('noReadyBackends')}</FormAlert>
        ) : (
          <p className={styles.note}>{t('backendHint', { backend: form.backend.label })}</p>
        )}
        {pending && (
          <p className={styles.pending} role="status">
            {t('generating')}
          </p>
        )}
      </form>
    </Dialog>
  );
}
