import { Button, Dialog, FormAlert, SelectField, TextAreaField } from '@/shared/ui';
import { useBackgroundGeneration } from '../useBackgroundGeneration';
import { tAppearance as t } from '../i18n/appearance';
import styles from './GenerateBackgroundDialog.module.css';

const FORM_ID = 'generate-background';
export function GenerateBackgroundDialog({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (id: string) => void;
}) {
  const form = useBackgroundGeneration(onGenerated, onClose);
  return (
    <Dialog
      title={t('backgroundGenerateTitle')}
      description={t('backgroundGenerateHint')}
      onClose={() => void form.close()}
      size="sm"
      footer={
        <>
          <Button disabled={form.stopping} onClick={() => void form.close()}>
            {form.pending ? t('backgroundStop') : t('backgroundCancel')}
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={form.pending || !form.backendId}>
            {t('backgroundGenerate')}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className={styles.form}
        onSubmit={(event) => void form.submit(event)}
        aria-busy={form.pending}
        noValidate
      >
        {form.error && <FormAlert>{form.error}</FormAlert>}
        <TextAreaField
          label={t('backgroundSubject')}
          hint={t('backgroundSubjectHint')}
          value={form.description}
          onChange={form.setDescription}
          error={form.descriptionError}
          maxLength={400}
          rows={3}
          disabled={form.pending}
          data-autofocus
        />
        <SelectField
          label={t('backgroundBackend')}
          value={form.backendId}
          onChange={form.setSelected}
          disabled={form.pending || !form.backendId}
        >
          {form.backends.map((backend) => (
            <option key={backend.id} value={backend.id}>
              {backend.label}
            </option>
          ))}
        </SelectField>
        {!form.backendId && <FormAlert>{t('backgroundNoReady')}</FormAlert>}
        {form.pending && <p role="status">{t('backgroundGenerating')}</p>}
      </form>
    </Dialog>
  );
}
