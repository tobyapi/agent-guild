import { Badge, Field, Icon } from '@/shared/ui';
import { TAG_COUNT_MAX } from '@/shared/lib/tags';
import { useTemplates } from '../../hooks/useAgents';
import { useTagInput } from '../../hooks/useTagInput';
import { tagAccent } from '../../model/accent';
import { removeTag } from '../../model/tagInput';
import styles from './TagField.module.css';

export interface TagFieldProps {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  /** 入力全体の問題（検証・保存のエラー） */
  error?: string;
  onBlur: () => void;
}

/** タグの札の入力（docs/ui-design.md §5.11）: Enter・読点・カンマで札にし、× で外す。先頭は役割のカードで変更し、それ以外は分類用 */
export function TagField({ tags, onChange, error, onBlur }: TagFieldProps) {
  const input = useTagInput(tags, onChange);
  const full = tags.length >= TAG_COUNT_MAX;
  return (
    <Field
      label="タグ"
      optional
      hint={
        full
          ? `タグは ${TAG_COUNT_MAX} 個までです`
          : '役割は上のカードで変更できます。追加のタグは分類用です。Enter・読点・カンマで追加できます。'
      }
      error={input.problem ?? error}
    >
      {(control) => (
        <div className={styles.box} data-invalid={control['aria-invalid'] ? '' : undefined}>
          {tags.length > 0 && <TagChips tags={tags} onChange={onChange} />}
          <input
            {...control}
            className={styles.input}
            value={input.text}
            disabled={full}
            onChange={(event) => input.changeText(event.target.value)}
            onKeyDown={input.onKeyDown}
            onCompositionStart={input.onCompositionStart}
            onCompositionEnd={(event) => input.onCompositionEnd(event.currentTarget.value)}
            onBlur={() => {
              input.flush();
              onBlur();
            }}
            placeholder={tags.length === 0 ? '例: リサーチ' : 'タグを追加'}
            autoComplete="off"
          />
        </div>
      )}
    </Field>
  );
}

/** 付けたタグの札。色はそのタグを先頭に持つテンプレートの accent。先頭の役割はここでは変更・削除しない */
function TagChips({ tags, onChange }: Pick<TagFieldProps, 'tags' | 'onChange'>) {
  const templates = useTemplates();
  return (
    <ul className={styles.chips} aria-label="付けたタグ">
      <li className={styles.lead} aria-hidden="true">
        役割
      </li>
      {tags.map((tag, index) => (
        <li key={`${index}-${tag}`}>
          <Badge accent={tagAccent(templates, tag)}>
            <span>{tag}</span>
            {index > 0 && (
              <button
                type="button"
                className={styles.remove}
                aria-label={`タグ「${tag}」を外す`}
                onClick={() => onChange(removeTag(tags, index))}
              >
                <Icon name="close" />
              </button>
            )}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
