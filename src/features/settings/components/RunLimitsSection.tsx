import { useEffect, useState } from 'react';
import { DEFAULT_RUN_LIMITS, MAX_CONCURRENT_JOBS, RUN_TIMEOUT_MINUTES, type RunLimits } from '@/shared/types/domain';
import { Button, FormAlert, SelectField } from '@/shared/ui';
import { settingsApi } from '../api';
import { t } from '../i18n';

const concurrentJobChoices = Array.from({ length: MAX_CONCURRENT_JOBS }, (_, index) => index + 1);

export function RunLimitsSection() {
  const [saved, setSaved] = useState<RunLimits | null>(null);
  const [draft, setDraft] = useState<RunLimits>(DEFAULT_RUN_LIMITS);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void settingsApi.getRunLimits().then(
      (limits) => {
        if (!active) return;
        setDraft(limits);
        setSaved(limits);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      await settingsApi.setRunLimits(draft);
      setSaved(draft);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const disabled = saved === null || busy;
  const changed =
    draft.timeoutMinutes !== saved?.timeoutMinutes || draft.maxConcurrentJobs !== saved?.maxConcurrentJobs;
  return (
    <>
      <SelectField
        label={t('runTimeoutLabel')}
        hint={t('runTimeoutHint')}
        value={draft.timeoutMinutes?.toString() ?? ''}
        onChange={(value) => {
          const timeoutMinutes = RUN_TIMEOUT_MINUTES.find((minutes) => String(minutes) === value) ?? null;
          setDraft((current) => ({ ...current, timeoutMinutes }));
        }}
        disabled={disabled}
      >
        <option value="">{t('runLimitsUnlimited')}</option>
        {RUN_TIMEOUT_MINUTES.map((minutes) => (
          <option key={minutes} value={minutes}>
            {t('runTimeoutMinutes', { minutes })}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t('concurrentJobsLabel')}
        hint={t('concurrentJobsHint')}
        value={draft.maxConcurrentJobs?.toString() ?? ''}
        onChange={(value) => setDraft((current) => ({ ...current, maxConcurrentJobs: Number(value) || null }))}
        disabled={disabled}
      >
        <option value="">{t('runLimitsUnlimited')}</option>
        {concurrentJobChoices.map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </SelectField>
      {failed && <FormAlert>{t('runLimitsFailed')}</FormAlert>}
      <Button disabled={disabled || !changed} onClick={() => void save()}>
        {t('runLimitsSave')}
      </Button>
    </>
  );
}
