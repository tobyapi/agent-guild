import { AvatarInput, ColorInput, TextField } from '@/shared/ui';
import { AvatarPresetPicker } from './AvatarPresetPicker';
import { EditorSection } from './EditorSection';
import type { SectionProps } from './EditorSection';
import { TagField } from './TagField';

/** 基本: 名前・タグ・アバター・個人色 */
export function BasicsFields({ draft, update, errors, touch }: SectionProps) {
  const setAvatar = (avatar: string) => update('avatar', avatar);
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
      <TagField
        tags={draft.tags}
        onChange={(tags) => update('tags', tags)}
        error={errors.tags}
        onBlur={() => touch('tags')}
      />
      <AvatarInput
        value={draft.avatar}
        onChange={setAvatar}
        error={errors.avatar}
        imageActions={<AvatarPresetPicker onChoose={setAvatar} />}
      />
      <ColorInput value={draft.color} onChange={(value) => update('color', value)} />
    </EditorSection>
  );
}
