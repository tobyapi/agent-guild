import { useEffect, useState } from 'react';
import { Avatar, Button, Dialog, Icon, reportError } from '@/shared/ui';
import { agentsApi } from '../../api';
import { tEditor } from '../../i18n/editor';
import { AVATAR_GALLERY, AVATAR_PRESETS, loadPresetAvatar, loadPresetMascot } from '../../model/avatarPresets';
import styles from './AvatarPresetPicker.module.css';

const LOAD_TIMEOUT_MS = 20_000;

type PickerProps = { onChoose: (avatar: string) => void; fullBody?: boolean };

export function AvatarPresetPicker({ onChoose, fullBody = false }: PickerProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="users" />
        {tEditor('avatarGallery')}
      </Button>
      {open && (
        <AvatarPresetDialog
          onClose={close}
          fullBody={fullBody}
          onChoose={(avatar) => {
            onChoose(avatar);
            close();
          }}
        />
      )}
    </>
  );
}

function AvatarPresetDialog({ onClose, onChoose, fullBody }: PickerProps & { onClose: () => void }) {
  const [avatars, setAvatars] = useState<(string | null)[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    let mounted = true;
    const load = fullBody ? loadPresetMascot : loadPresetAvatar;
    void Promise.allSettled(AVATAR_PRESETS.map((preset) => load(preset, controller.signal))).then((results) => {
      clearTimeout(timer);
      if (mounted) setAvatars(results.map((result) => (result.status === 'fulfilled' ? result.value : null)));
    });
    return () => {
      mounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, fullBody]);

  return (
    <Dialog
      title={tEditor(fullBody ? 'mascotGalleryTitle' : 'avatarDialogTitle')}
      size="lg"
      onClose={onClose}
      description={tEditor(fullBody ? 'mascotGalleryDescription' : 'avatarDialogDescription')}
      footer={<Button onClick={onClose}>{tEditor('cancel')}</Button>}
    >
      {avatars === null && (
        <p role="status" className={styles.note}>
          {tEditor('avatarLoading')}
        </p>
      )}
      {avatars?.includes(null) && (
        <div className={styles.problem}>
          <p role="status">{tEditor(fullBody ? 'mascotGalleryLoadFailed' : 'avatarLoadFailed')}</p>
          <Button
            size="sm"
            onClick={() => {
              setAvatars(null);
              setAttempt((value) => value + 1);
            }}
          >
            {tEditor('avatarReload')}
          </Button>
        </div>
      )}
      <ul className={styles.grid}>
        {AVATAR_PRESETS.map((preset, index) => {
          const avatar = avatars?.[index];
          return (
            <li key={preset.id}>
              <Button
                className={styles.tile}
                disabled={!avatar}
                onClick={() => {
                  if (avatar) onChoose(avatar);
                }}
              >
                {fullBody && avatar ? (
                  <img className={styles.portrait} src={avatar} alt="" />
                ) : (
                  <Avatar avatar={avatar ?? ''} name={preset.name} size="lg" />
                )}
                <span>{preset.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>
        {tEditor('avatarCredit')}
        <Button variant="link" onClick={() => void agentsApi.openUrl(AVATAR_GALLERY).catch(reportError)}>
          {tEditor('avatarOpenGallery')}
        </Button>
      </p>
    </Dialog>
  );
}
