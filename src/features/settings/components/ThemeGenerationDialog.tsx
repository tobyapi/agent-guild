import { useEffect, useState } from 'react';
import { useBackends } from '@/features/runtime';
import { Button, Dialog, FormAlert, SelectField, TextAreaField } from '@/shared/ui';
import { useThemeDraft } from '../useThemeDraft';
import { settingsApi } from '../api';
import { tAppearance as t } from '../i18n/appearance';
import { ThemeDraftPreview } from './ThemeDraftPreview';
import styles from './GenerateBackgroundDialog.module.css';

function ImageChoice({
  choose,
  retry,
  available,
}: {
  choose: (id: string | null) => void;
  retry: () => void;
  available: boolean;
}) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void settingsApi
      .listBackgrounds()
      .then((list) => {
        if (live) setIds(list);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <p>{t('imageOptions')}</p>
      <Button disabled={!available} onClick={retry}>
        {t('imageRetry')}
      </Button>
      {ids.length > 0 && (
        <SelectField label={t('backgroundLabel')} value="" onChange={choose}>
          <option value="" disabled>
            {t('backgroundLabel')}
          </option>
          {ids.map((id, i) => (
            <option key={id} value={id}>
              {t('backgroundImage')} {i + 1}
            </option>
          ))}
        </SelectField>
      )}
      <Button onClick={() => choose(null)}>{t('noImage')}</Button>
    </>
  );
}
export function ThemeGenerationDialog({ onClose }: { onClose: () => void }) {
  const { writer, writers, renderer, setSelected } = useGenerators();
  const draft = useThemeDraft(writer, renderer, onClose);
  const busy = draft.stage === 'palette' || draft.stage === 'image' || draft.stopping;

  return (
    <Dialog
      title={t('themeCreate')}
      onClose={() => void draft.close()}
      footer={<DraftButtons draft={draft} busy={busy} />}
    >
      <div className={styles.form} aria-busy={busy}>
        {draft.stage === 'subject' && (
          <SubjectFields draft={draft} writer={writer} writers={writers} setSelected={setSelected} />
        )}
        <DraftProblems draft={draft} />
        {busy && <p role="status">{draft.stage === 'palette' ? t('paletteGenerating') : t('backgroundGenerating')}</p>}
        {draft.stage === 'chooseImage' && draft.candidate && (
          <ImageChoice
            choose={draft.chooseImage}
            available={!!renderer}
            retry={() => void draft.background(draft.candidate!)}
          />
        )}
        {draft.stage === 'preview' && draft.candidate && (
          <ThemeDraftPreview candidate={draft.candidate} image={draft.image} />
        )}
        <small>{t('draftImageNotice')}</small>
      </div>
    </Dialog>
  );
}

function SubjectFields({
  draft,
  writer,
  writers,
  setSelected,
}: {
  draft: ReturnType<typeof useThemeDraft>;
  writer: string;
  writers: { id: string; label: string }[];
  setSelected: (id: string) => void;
}) {
  return (
    <>
      <TextAreaField
        label={t('backgroundSubject')}
        value={draft.subject}
        onChange={draft.setSubject}
        maxLength={400}
        rows={3}
      />
      {writers.length > 1 && (
        <SelectField label={t('backgroundBackend')} value={writer} onChange={setSelected}>
          {writers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </SelectField>
      )}
      {!writer && <FormAlert>{t('noThemeBackend')}</FormAlert>}
      <Button
        disabled={!writer || !draft.subject.trim() || Array.from(draft.subject.trim()).length > 200}
        onClick={() => void draft.generate()}
      >
        {t('backgroundGenerate')}
      </Button>
    </>
  );
}
function DraftProblems({ draft }: { draft: ReturnType<typeof useThemeDraft> }) {
  const issue = draft.issues[0];
  return (
    <>
      {draft.problem && (
        <FormAlert>
          {t(
            (
              {
                invalid: 'invalidTheme',
                failed: 'themeFailed',
                save: 'themeSaveFailed',
                cancel: 'backgroundCancelFailed',
              } as const
            )[draft.problem],
          )}
        </FormAlert>
      )}
      {issue && (
        <FormAlert>
          {t('contrastFailed')} {issue.scheme} / {issue.foreground} / {issue.background} · {issue.ratio.toFixed(3)}:1 (
          {t('requiredContrast')} {issue.required}:1)
        </FormAlert>
      )}
    </>
  );
}

function useGenerators() {
  const backends = useBackends().filter((b) => b.status === 'ready');
  const writers = backends.filter((b) => b.themeGeneration);
  const renderer = backends.find((b) => b.backgroundGeneration)?.id ?? '';
  const [selected, setSelected] = useState('');
  const writer = writers.find((b) => b.id === selected)?.id ?? writers[0]?.id ?? '';
  return { writer, writers, renderer, setSelected };
}

function DraftButtons({ draft, busy }: { draft: ReturnType<typeof useThemeDraft>; busy: boolean }) {
  return (
    <>
      <Button disabled={draft.stopping} onClick={() => void draft.close()}>
        {busy ? t('backgroundStop') : t('backgroundCancel')}
      </Button>
      {draft.stage === 'preview' && (
        <>
          <Button onClick={() => draft.save(false)}>{t('themeSave')}</Button>
          <Button variant="primary" onClick={() => draft.save(true)}>
            {t('saveApply')}
          </Button>
        </>
      )}
    </>
  );
}
