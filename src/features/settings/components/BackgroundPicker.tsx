import { canGenerateBackground } from '../useBackgroundGeneration';
import { useBackgroundLibrary } from '../useBackgroundLibrary';
import { BackgroundChoices } from './BackgroundChoices';
import { useRef, useState } from 'react';
import { useBackends } from '@/features/runtime';
import { GenerateBackgroundDialog } from './GenerateBackgroundDialog';
import { Button, ConfirmDialog } from '@/shared/ui';
import type { Scheme } from '@/shared/theme/types';
import { tAppearance as t } from '../i18n/appearance';
import fields from './AccentPicker.module.css';

export function BackgroundPicker({ scheme, revision = 0 }: { scheme: Scheme; revision?: number }) {
  const { ids, error, busy, removing, setRemoving, add, remove, generated } = useBackgroundLibrary(revision);
  const [generating, setGenerating] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const canGenerate = useBackends().some(canGenerateBackground);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={fields.field}>
      <span className={fields.label} aria-hidden="true">
        {t('backgroundLabel')}
      </span>
      <BackgroundChoices ids={ids} scheme={scheme} busy={busy} setRemoving={setRemoving} />
      <input
        ref={input}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        aria-label={t('backgroundAdd')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void add(file);
        }}
      />
      <div className={fields.actions}>
        <Button disabled={busy} onClick={() => input.current?.click()}>
          {t('backgroundAdd')}
        </Button>
        {canGenerate && (
          <Button
            disabled={busy}
            onClick={() => {
              setCancelled(false);
              setGenerating(true);
            }}
          >
            {t('backgroundGenerateTitle')}
          </Button>
        )}
      </div>
      {generating && (
        <GenerateBackgroundDialog
          onClose={(wasCancelled) => {
            setCancelled(wasCancelled);
            setGenerating(false);
          }}
          onGenerated={(id) => {
            generated(id);
            setGenerating(false);
          }}
        />
      )}
      {cancelled && <p role="status">{t('backgroundCancelled')}</p>}
      {error && <p role="alert">{error}</p>}
      {removing && (
        <ConfirmDialog
          title={t('backgroundDelete')}
          message={t('backgroundDeleteConfirm')}
          confirmLabel={t('backgroundDelete')}
          danger
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => {
            if (!busy) setRemoving(null);
          }}
        />
      )}
    </div>
  );
}
