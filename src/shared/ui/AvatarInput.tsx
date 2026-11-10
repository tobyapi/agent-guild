import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { isImageAvatar } from '@/shared/lib/avatar';
import { AVATAR_IMAGE_ACCEPT, AVATAR_IMAGE_SIZE, checkAvatarImageFile } from '@/shared/lib/image';
import { AvatarCropDialog } from './avatarCrop/AvatarCropDialog';
import { Button } from './Button';
import { Field } from './field/Field';
import { Icon } from './Icon';
import { notifyError } from './toast/store';
import styles from './AvatarInput.module.css';

export interface AvatarInputProps {
  value: string;
  onChange: (avatar: string) => void;
  error?: string | null;
  /** 人間のアバター（切り抜きの形を円にする。エージェントは角丸） */
  human?: boolean;
  imageActions?: ReactNode;
}

/** アバターの入力: 絵文字を打つか、画像を選んで切り抜く（キャンセルしたら元のまま） */
export function AvatarInput({ value, onChange, error, human = false, imageActions }: AvatarInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const usingImage = isImageAvatar(value);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = checkAvatarImageFile(file);
    if (problem) notifyError(problem);
    else setCropping(file);
  };

  return (
    <Field
      label="アバター"
      hint={`絵文字を 1 つ入力するか、画像を選んで範囲を切り抜けます（${AVATAR_IMAGE_SIZE}px で保存します）`}
      error={error}
    >
      {(control) => (
        <div className={styles.row}>
          <input
            {...control}
            className={styles.emoji}
            value={usingImage ? '' : value}
            placeholder={usingImage ? '画像' : '🙂'}
            maxLength={16}
            onChange={(event) => onChange(event.target.value)}
          />
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Icon name="image" />
            画像を選ぶ
          </Button>
          {imageActions}
          {usingImage && (
            <Button size="sm" variant="ghost" onClick={() => onChange('')}>
              画像を外す
            </Button>
          )}
          <input ref={fileRef} type="file" accept={AVATAR_IMAGE_ACCEPT} hidden onChange={handleFile} />
          {cropping && (
            <AvatarCropDialog
              file={cropping}
              human={human}
              onCancel={() => setCropping(null)}
              onConfirm={(avatar) => {
                onChange(avatar);
                setCropping(null);
              }}
            />
          )}
        </div>
      )}
    </Field>
  );
}
