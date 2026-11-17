import { useEffect, useState } from 'react';
import { Button, FormAlert, TextAreaField } from '@/shared/ui';
import { GLOBAL_INSTRUCTIONS_LIMIT } from '@/shared/lib/globalInstructions';
import { settingsApi } from '../api';
import { t } from '../i18n';

export function GlobalInstructionsSection() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void settingsApi.getGlobalInstructions().then(
      (value) => {
        if (active) {
          setText(value);
          setSaved(value);
        }
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const tooLong = text.length > GLOBAL_INSTRUCTIONS_LIMIT;
  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await settingsApi.setGlobalInstructions(text);
      setSaved(text);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <TextAreaField
        label={t('globalInstructionsTitle')}
        hint={t('globalInstructionsHint')}
        value={text}
        onChange={setText}
        rows={8}
        mono
        disabled={saved === null || busy}
        error={tooLong ? t('globalInstructionsTooLong') : undefined}
      />
      <p aria-live="polite">
        {text.length} / {GLOBAL_INSTRUCTIONS_LIMIT}
      </p>
      {failed && <FormAlert>{t('globalInstructionsFailed')}</FormAlert>}
      <Button disabled={saved === null || busy || tooLong || text === saved} onClick={() => void save()}>
        {t('globalInstructionsSave')}
      </Button>
    </>
  );
}
