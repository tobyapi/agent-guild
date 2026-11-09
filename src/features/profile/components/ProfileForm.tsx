import { Avatar, AvatarInput, Button, ColorInput, TextField } from '@/shared/ui';
import { useProfileForm } from '../hooks/useProfileForm';
import styles from './ProfileForm.module.css';

export interface ProfileFormProps {
  /** 重複してはいけない名前（削除されていないエージェントの名前） */
  takenNames: readonly string[];
}

/** プロフィール（名前・アバター・個人色）の編集。設定ダイアログに置く */
export function ProfileForm({ takenNames }: ProfileFormProps) {
  const form = useProfileForm(takenNames);
  const { draft, errors } = form;
  return (
    <form className={styles.form} onSubmit={form.onSubmit} noValidate>
      <div className={styles.identity}>
        <Avatar avatar={draft.avatar} name={draft.name} color={draft.color} size="lg" human />
        <div className={styles.fields}>
          <TextField
            label="名前"
            value={draft.name}
            onChange={(value) => form.update('name', value)}
            onBlur={() => form.touch('name')}
            error={errors.name}
            maxLength={64}
            autoComplete="off"
            data-autofocus
          />
          <AvatarInput
            value={draft.avatar}
            onChange={(value) => form.update('avatar', value)}
            error={errors.avatar}
            human
          />
        </div>
      </div>
      <ColorInput value={draft.color} onChange={(value) => form.update('color', value)} human />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={form.saving}>
          {form.saving ? '保存中…' : '保存'}
        </Button>
      </div>
    </form>
  );
}
