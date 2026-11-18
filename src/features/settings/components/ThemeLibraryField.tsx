import { useState } from 'react';
import { Button, ConfirmDialog, FormAlert, SelectField } from '@/shared/ui';
import { themeActions, useAppearanceStore } from '../appearance';
import { tAppearance as t } from '../i18n/appearance';
import { ThemeGenerationDialog } from './ThemeGenerationDialog';
import fields from './AccentPicker.module.css';

export function ThemeLibraryField() {
  const state = useAppearanceStore((s) => s);
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState(false);
  const name = (id: string) => state.themes.find((theme) => theme.id === id)?.name ?? t('builtInTheme');
  const issue = state.issues[0];
  return (
    <div className={fields.field}>
      {state.readOnly && <FormAlert>{t('newerTheme')}</FormAlert>}
      <SelectField
        label={t('themeLabel')}
        value={state.active.themeId}
        onChange={themeActions.select}
        disabled={state.readOnly}
      >
        <option value="guild">{t('builtInTheme')}</option>
        {state.themes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </SelectField>
      <div>
        <Button disabled={state.readOnly} onClick={() => setOpen(true)}>
          {t('themeCreate')}
        </Button>
        {state.previous && (
          <Button disabled={state.readOnly} onClick={themeActions.undo}>
            {t('themeUndo')}
          </Button>
        )}
        {state.active.themeId !== 'guild' && (
          <Button disabled={state.readOnly} onClick={() => setRemove(true)}>
            {t('themeRemove')}
          </Button>
        )}
      </div>
      {state.problem === 'save' && <FormAlert>{t('themeSaveFailed')}</FormAlert>}
      {state.problem === 'contrast' && issue && (
        <FormAlert>
          {t('contrastFailed')} {issue.scheme} / {issue.foreground} / {issue.background} · {issue.ratio.toFixed(3)}:1 (
          {t('requiredContrast')} {issue.required}:1)
        </FormAlert>
      )}
      {state.missingId && <FormAlert>{t('missingImage')}</FormAlert>}
      {open && <ThemeGenerationDialog onClose={() => setOpen(false)} />}
      {remove && (
        <ConfirmDialog
          title={t('themeRemove')}
          message={name(state.active.themeId) + ' → ' + name(state.previous?.themeId ?? 'guild')}
          danger
          confirmLabel={t('themeRemove')}
          onCancel={() => setRemove(false)}
          onConfirm={() => {
            if (themeActions.remove(state.active.themeId)) setRemove(false);
          }}
        />
      )}
    </div>
  );
}
