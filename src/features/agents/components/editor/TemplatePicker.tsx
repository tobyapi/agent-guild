import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { SelectField } from '@/shared/ui';
import type { AgentTemplate } from '@/shared/types/domain';
import { useTemplates } from '../../hooks/useAgents';
import { presetsFor } from '../../model/presets';
import type { AgentPreset } from '../../model/presets';
import { AccentMark } from '../AccentMark';
import { EditorSection } from './EditorSection';
import styles from './Editor.module.css';

export interface TemplatePickerProps {
  editing: boolean;
  templateId: string | null;
  /** 入力した内容を、選んだテンプレートの値で置き換えた（その旨を出す） */
  replaced: boolean;
  onTemplate: (template: AgentTemplate) => void;
  onPreset: (preset: AgentPreset) => void;
}

const STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** 作成・編集共通の役割カード（docs/ui-design.md §5.9）と、作成時の人格の書き出し例。 */
export function TemplatePicker({ templateId, replaced, onTemplate, onPreset, editing }: TemplatePickerProps) {
  const templates = useTemplates();
  const questionId = useId();
  if (templates.length === 0) return null;
  const presets = presetsFor(templateId);
  const checkedIndex = templates.findIndex((template) => template.id === templateId);
  // 矢印キーで隣のカードへ移って選ぶ（ラジオグループのキーボード操作）
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = STEPS[event.key];
    const next = step === undefined ? undefined : templates[(index + step + templates.length) % templates.length];
    if (!next) return;
    event.preventDefault();
    onTemplate(next);
    const cards = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    cards?.[(index + (step ?? 0) + templates.length) % templates.length]?.focus();
  };
  const pickPreset = (id: string) => {
    const preset = presets.find((candidate) => candidate.id === id);
    if (preset) onPreset(preset);
  };
  return (
    <EditorSection title="役割">
      <p id={questionId} className={styles.question}>
        どんな役割を任せますか
      </p>
      <p className={styles.help}>
        まずは作業者1人から。案出し・専門的な確認・進行管理が必要になったら仲間を加えられます。できることは役割ごとに決まります。作成・役割変更時に、その役割に合う内蔵スキルも追加します。不要なスキルは後から外せます。
      </p>
      <div className={styles.templates} role="radiogroup" aria-labelledby={questionId}>
        {templates.map((template, index) => (
          <button
            key={template.id}
            type="button"
            role="radio"
            className={styles.template}
            aria-checked={index === checkedIndex}
            tabIndex={index === checkedIndex || (checkedIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => onTemplate(template)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className={styles.templateMark}>
              <AccentMark accent={template.accent} />
            </span>
            <b className={styles.templateName}>{template.label}</b>
            <span className={styles.templateDescription}>{template.description}</span>
          </button>
        ))}
      </div>
      {replaced && <p className={styles.help}>入力した内容は、選んだテンプレートの値に置き換わります</p>}
      {!editing && presets.length > 0 && (
        <SelectField
          label="人格の例"
          optional
          value=""
          onChange={pickPreset}
          hint="名前や担当などの書き出し例を流し込みます。"
        >
          <option value="">人格の例を選ぶ…</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.title}（{preset.values.name}）
            </option>
          ))}
        </SelectField>
      )}
    </EditorSection>
  );
}
