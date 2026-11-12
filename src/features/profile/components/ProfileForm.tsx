import { FramePicker, MemberAvatar } from '@/features/frames';
import { AvatarInput, Button, ColorInput, TextField } from '@/shared/ui';
import { useProfileForm } from '../hooks/useProfileForm';
import { t } from '../i18n';
import styles from './ProfileForm.module.css';

export interface ProfileFormProps {
  /** 重複してはいけない名前（削除されていないエージェントの名前） */
  takenNames: readonly string[];
}

/** プロフィール（名前・アバター・アイコンの枠・個人色）の編集。設定ダイアログに置く */
export function ProfileForm({ takenNames }: ProfileFormProps) {
  const form = useProfileForm(takenNames);
  const { draft, errors } = form;
  return (
    <form className={styles.form} onSubmit={form.onSubmit} noValidate>
      <div className={styles.identity}>
        <MemberAvatar
          avatar={draft.avatar}
          name={draft.name}
          color={draft.color}
          frame={draft.frame}
          size="lg"
          human
          className={styles.avatar}
        />
        <div className={styles.fields}>
          <TextField
            label={t('name')}
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
      <FramePicker
        value={draft.frame}
        onChange={(frame) => form.update('frame', frame)}
        avatar={draft.avatar}
        name={draft.name}
        color={draft.color}
        human
      />
      <ColorInput value={draft.color} onChange={(value) => form.update('color', value)} human />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={form.saving}>
          {form.saving ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
