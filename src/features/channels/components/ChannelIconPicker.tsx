import { Field } from '@/shared/ui';
import { CHANNEL_HASH } from '@/shared/lib/channelIcon';
import { SUGGESTED_CHANNEL_ICONS } from '../model/icons';
import { tIcon } from '../i18n/icon';
import styles from './ChannelIconPicker.module.css';

export interface ChannelIconPickerProps {
  /** 空ならアイコンなし（# を出す） */
  value: string;
  onChange: (icon: string) => void;
  onBlur?: () => void;
  error?: string | null;
}

/** チャンネルのアイコンを選ぶ欄: 今のアイコン（直接入力できる）＋「なし（#）」とおすすめの絵文字 */
export function ChannelIconPicker({ value, onChange, onBlur, error }: ChannelIconPickerProps) {
  const current = value.trim();
  return (
    <Field label={tIcon('label')} optional hint={tIcon('hint')} error={error}>
      {(control) => (
        <div className={styles.picker}>
          <input
            {...control}
            className={styles.input}
            value={value}
            placeholder={tIcon('inputPlaceholder')}
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
          />
          <div className={styles.grid} role="group" aria-label={tIcon('suggestions')}>
            <button
              type="button"
              className={styles.choice}
              data-none=""
              aria-pressed={current === ''}
              aria-label={tIcon('none')}
              title={tIcon('none')}
              onClick={() => onChange('')}
            >
              {CHANNEL_HASH}
            </button>
            {SUGGESTED_CHANNEL_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={styles.choice}
                aria-pressed={current === icon}
                aria-label={tIcon('choose', { icon })}
                onClick={() => onChange(icon)}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </Field>
  );
}
