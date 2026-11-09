import { AvatarInput, ColorInput, TextField } from '@/shared/ui';
import { EditorSection } from './EditorSection';
import type { SectionProps } from './EditorSection';
import { TagField } from './TagField';

/** 基本: 名前・タグ・アバター・個人色 */
export function BasicsFields({ draft, update, errors, touch }: SectionProps) {
  return (
    <EditorSection title="基本">
      <TextField
        label="名前"
        value={draft.name}
        onChange={(value) => update('name', value)}
        onBlur={() => touch('name')}
        error={errors.name}
        hint="@名前 で呼びかけます。空白と @ は使えません。"
        maxLength={64}
        autoComplete="off"
        data-autofocus
      />
      <TagField tags={draft.tags} onChange={(tags) => update('tags', tags)} error={errors.tags} onBlur={() => touch('tags')} />
      <AvatarInput value={draft.avatar} onChange={(value) => update('avatar', value)} error={errors.avatar} />
      <ColorInput value={draft.color} onChange={(value) => update('color', value)} />
    </EditorSection>
  );
}
