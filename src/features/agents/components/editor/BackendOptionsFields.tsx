// バックエンド固有設定の汎用フォーム（OptionSpec → 部品。docs/ui-design.md §5.10）。
import { useId } from 'react';
import { Button, FieldError, Segment, SelectField, SwitchField, TextField } from '@/shared/ui';
import type { BackendInfo, OptionSpec } from '@/shared/types/domain';
import { defaultLabel, isCustomized } from '../../model/backendOptions';
import type { OptionValue, OptionValues } from '../../model/backendOptions';
import styles from './Editor.module.css';

export interface BackendOptionsFieldsProps {
  backend: BackendInfo;
  values: OptionValues;
  errors: Record<string, string>;
  onChange: (values: OptionValues) => void;
}

/** 「{label} の詳細設定」。すべて既定なら畳み、既定と違う値（かエラー）があれば開いておく */
export function BackendOptionsFields({ backend, values, errors, onChange }: BackendOptionsFieldsProps) {
  const open = backend.options.some((spec) => isCustomized(spec, values)) || Object.keys(errors).length > 0;
  const set = (key: string, value: OptionValue | undefined) => {
    const rest = Object.fromEntries(Object.entries(values).filter(([candidate]) => candidate !== key));
    onChange(value === undefined ? rest : { ...rest, [key]: value });
  };
  return (
    <details className={styles.details} open={open}>
      <summary className={styles.summary}>{backend.label} の詳細設定</summary>
      <div className={styles.detailsBody}>
        {backend.options.map((spec) => (
          <OptionField
            key={spec.key}
            spec={spec}
            value={values[spec.key]}
            error={errors[spec.key]}
            onChange={(value) => set(spec.key, value)}
          />
        ))}
      </div>
    </details>
  );
}

interface OptionFieldProps {
  spec: OptionSpec;
  value: OptionValue | undefined;
  error: string | undefined;
  /** undefined は「既定に戻す」 */
  onChange: (value: OptionValue | undefined) => void;
}

/** 選択肢が 4 つ以下で、どれも短ければセグメントにする */
const fitsSegment = (spec: OptionSpec) =>
  spec.choices.length <= 4 && spec.choices.every((choice) => choice.length <= 12);

function OptionField(props: OptionFieldProps) {
  if (props.spec.type === 'boolean') return <BooleanOption {...props} />;
  if (props.spec.type === 'select')
    return fitsSegment(props.spec) ? <SegmentOption {...props} /> : <SelectOption {...props} />;
  return <TextOption {...props} />;
}

function ResetButton({ spec, value, onChange }: OptionFieldProps) {
  if (!isCustomized(spec, { [spec.key]: value ?? '' })) return null;
  return (
    <Button variant="link" onClick={() => onChange(undefined)}>
      既定に戻す
    </Button>
  );
}

function BooleanOption({ spec, value, onChange }: OptionFieldProps) {
  const checked = typeof value === 'boolean' ? value : spec.default === true;
  return <SwitchField label={spec.label} hint={spec.description || undefined} checked={checked} onChange={onChange} />;
}

function TextOption(props: OptionFieldProps) {
  const { spec, value, error, onChange } = props;
  const fallback = defaultLabel(spec);
  return (
    <TextField
      label={spec.label}
      hint={spec.description || undefined}
      labelAction={<ResetButton {...props} />}
      value={typeof value === 'string' ? value : ''}
      onChange={onChange}
      type={spec.type === 'number' ? 'number' : 'text'}
      numeric={spec.type === 'number'}
      placeholder={fallback ? `既定: ${fallback}` : undefined}
      error={error}
    />
  );
}

const currentChoice = (spec: OptionSpec, value: OptionValue | undefined) =>
  typeof value === 'string' && value !== '' ? value : defaultLabel(spec);

const choiceLabel = (spec: OptionSpec, choice: string) =>
  choice === defaultLabel(spec) ? `${choice}（既定）` : choice;

function SelectOption(props: OptionFieldProps) {
  const { spec, value, error, onChange } = props;
  return (
    <SelectField
      label={spec.label}
      hint={spec.description || undefined}
      labelAction={<ResetButton {...props} />}
      value={currentChoice(spec, value)}
      onChange={onChange}
      error={error}
    >
      {spec.choices.map((choice) => (
        <option key={choice} value={choice}>
          {choiceLabel(spec, choice)}
        </option>
      ))}
    </SelectField>
  );
}

function SegmentOption(props: OptionFieldProps) {
  const { spec, value, error, onChange } = props;
  const id = useId();
  const options = spec.choices.map((choice) => ({ value: choice, label: choiceLabel(spec, choice) }));
  return (
    <div className={styles.optionBlock}>
      <div className={styles.optionLabelRow}>
        <span className={styles.optionLabel}>{spec.label}</span>
        <ResetButton {...props} />
      </div>
      <Segment
        label={spec.label}
        value={currentChoice(spec, value)}
        options={options}
        onChange={onChange}
        describedBy={spec.description ? `${id}-hint` : undefined}
      />
      {spec.description && (
        <p id={`${id}-hint`} className={styles.help}>
          {spec.description}
        </p>
      )}
      {error && <FieldError message={error} />}
    </div>
  );
}
