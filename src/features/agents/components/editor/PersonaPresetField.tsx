import { useState } from 'react';
import { TextAreaField, TextField } from '@/shared/ui';
import { tEditor } from '../../i18n/editor';
import { appendPresetText, matchingPreset } from '../../model/personas/presetText';
import type { AnyPreset } from '../../model/personas/types';
import { PresetPicker } from './PresetPicker';
import styles from './PersonaPresetField.module.css';

export interface PersonaPresetFieldProps<T extends AnyPreset> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: readonly T[];
  placeholder: string;
  /** 複数行の入力にする（性格） */
  multiline?: boolean;
}

/**
 * 性格・口調の入力欄と［プリセット］（docs/persona-presets.md）。選ぶと文面を置き換え、別の文面があったときは
 * 「置き換えました」と［元に戻す］を出す。［追記］は句点でつないで足す。文面がプリセットと同じならその名前を小さく出す
 */
export function PersonaPresetField<T extends AnyPreset>({
  label,
  value,
  onChange,
  presets,
  placeholder,
  multiline,
}: PersonaPresetFieldProps<T>) {
  /** 置き換える前の文面（［元に戻す］で戻す） */
  const [previous, setPrevious] = useState<string | null>(null);
  const matched = matchingPreset(presets, value);
  const change = (next: string, undoTo: string | null = null) => {
    setPrevious(undoTo);
    onChange(next);
  };
  const replace = (preset: T) =>
    change(preset.text, value.trim() !== '' && value.trim() !== preset.text ? value : null);
  const action = (
    <span className={styles.action}>
      {matched && <span className={styles.matched}>{matched.label}</span>}
      <PresetPicker
        label={label}
        presets={presets}
        onReplace={replace}
        onAppend={(preset) => change(appendPresetText(value, preset.text))}
      />
    </span>
  );
  const hint =
    previous === null ? undefined : (
      <>
        {tEditor('replacedNotice')}
        <button type="button" className={styles.undo} onClick={() => change(previous)}>
          {tEditor('undo')}
        </button>
      </>
    );
  const shared = {
    label,
    optional: true,
    value,
    onChange: (next: string) => change(next),
    labelAction: action,
    hint,
    placeholder,
  };
  return multiline ? <TextAreaField {...shared} rows={2} /> : <TextField {...shared} />;
}
