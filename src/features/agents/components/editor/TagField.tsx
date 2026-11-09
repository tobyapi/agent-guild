import { Badge, Field, Icon } from '@/shared/ui';
import { TAG_COUNT_MAX } from '@/shared/lib/tags';
import { useTemplates } from '../../hooks/useAgents';
import { useTagInput } from '../../hooks/useTagInput';
import { tagAccent } from '../../model/accent';
import { promoteTag, removeTag } from '../../model/tagInput';
import styles from './TagField.module.css';

export interface TagFieldProps {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  /** 入力全体の問題（検証・保存のエラー） */
  error?: string;
  onBlur: () => void;
}

/** タグの札の入力（docs/ui-design.md §5.11）: Enter・読点・カンマで札にし、× で外す。先頭のタグがサイドバーの区分になる */
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
          : '先頭のタグがサイドバーの区分になります。Enter・読点・カンマで札にし、札を押すと先頭にできます。'
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

/** 付けたタグの札。色はそのタグを先頭に持つテンプレートの accent。先頭の札の前に「区分」、先頭以外は押すと先頭にする */
function TagChips({ tags, onChange }: Pick<TagFieldProps, 'tags' | 'onChange'>) {
  const templates = useTemplates();
  return (
    <ul className={styles.chips} aria-label="付けたタグ">
      <li className={styles.lead} aria-hidden="true">
        区分
      </li>
      {tags.map((tag, index) => (
        <li key={`${index}-${tag}`}>
          <Badge accent={tagAccent(templates, tag)}>
            {index === 0 ? (
              <span title="先頭のタグ（サイドバーの区分と札）">{tag}</span>
            ) : (
              <button
                type="button"
                className={styles.promote}
                title="先頭にする"
                onClick={() => onChange(promoteTag(tags, index))}
              >
                {tag}
              </button>
            )}
            <button
              type="button"
              className={styles.remove}
              aria-label={`タグ「${tag}」を外す`}
              onClick={() => onChange(removeTag(tags, index))}
            >
              <Icon name="close" />
            </button>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
