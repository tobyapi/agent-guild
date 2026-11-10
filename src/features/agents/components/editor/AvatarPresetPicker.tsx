import { useEffect, useState } from 'react';
import { Avatar, Button, Dialog, Icon, reportError } from '@/shared/ui';
import { agentsApi } from '../../api';
import { AVATAR_GALLERY, AVATAR_PRESETS, loadPresetAvatar } from '../../model/avatarPresets';
import styles from './AvatarPresetPicker.module.css';

const LOAD_TIMEOUT_MS = 20_000;

export function AvatarPresetPicker({ onChoose }: { onChoose: (avatar: string) => void }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="users" />
        キャラ図鑑
      </Button>
      {open && (
        <AvatarPresetDialog
          onClose={close}
          onChoose={(avatar) => {
            onChoose(avatar);
            close();
          }}
        />
      )}
    </>
  );
}

function AvatarPresetDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (avatar: string) => void }) {
  const [avatars, setAvatars] = useState<(string | null)[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    let mounted = true;
    void Promise.allSettled(AVATAR_PRESETS.map((preset) => loadPresetAvatar(preset, controller.signal))).then(
      (results) => {
        clearTimeout(timer);
        if (mounted) setAvatars(results.map((result) => (result.status === 'fulfilled' ? result.value : null)));
      },
    );
    return () => {
      mounted = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  return (
    <Dialog
      title="キャラクターアイコン"
      size="lg"
      onClose={onClose}
      description="図鑑から画像を読み込みます。好きな顔を選び、エージェントを保存すると、この端末に保存されます。"
      footer={<Button onClick={onClose}>キャンセル</Button>}
    >
      {avatars === null && (
        <p role="status" className={styles.note}>
          図鑑の画像を読み込んでいます…
        </p>
      )}
      {avatars?.includes(null) && (
        <div className={styles.problem}>
          <p role="status">読み込めない画像があります。接続を確認して、もう一度お試しください。</p>
          <Button
            size="sm"
            onClick={() => {
              setAvatars(null);
              setAttempt((value) => value + 1);
            }}
          >
            再読み込み
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
                <Avatar avatar={avatar ?? ''} name={preset.name} size="lg" />
                <span>{preset.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>
        キャラクターイラストは ZipZipPipe。DeepSeek の原キャラクターは上善无形。
        <Button variant="link" onClick={() => void agentsApi.openUrl(AVATAR_GALLERY).catch(reportError)}>
          図鑑・利用条件を開く
        </Button>
      </p>
    </Dialog>
  );
}
