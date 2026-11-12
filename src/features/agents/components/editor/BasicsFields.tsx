import { FramePicker } from '@/features/frames';
import { AvatarInput, ColorInput, TextField } from '@/shared/ui';
import { tEditor } from '../../i18n/editor';
import { AvatarPresetPicker } from './AvatarPresetPicker';
import { EditorSection } from './EditorSection';
import type { SectionProps } from './EditorSection';
import { TagField } from './TagField';

/** 基本: 名前・タグ・アバター・アイコンの枠・個人色 */
export function BasicsFields({ draft, update, errors, touch }: SectionProps) {
  const setAvatar = (avatar: string) => update('avatar', avatar);
  return (
    <EditorSection title={tEditor('basicsSection')}>
      <TextField
        label={tEditor('nameLabel')}
        value={draft.name}
        onChange={(value) => update('name', value)}
        onBlur={() => touch('name')}
        error={errors.name}
        hint={tEditor('nameHint')}
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
      <FramePicker
        value={draft.frame}
        onChange={(frame) => update('frame', frame)}
        avatar={draft.avatar}
        name={draft.name.trim() || tEditor('unnamedInitial')}
        color={draft.color}
      />
      <ColorInput value={draft.color} onChange={(value) => update('color', value)} />
    </EditorSection>
  );
}
