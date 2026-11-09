import { useId } from 'react';
import type { CSSProperties } from 'react';
import {
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  imagePlacement,
  initialView,
  sourceRect,
  zoomViewCentered,
} from '@/shared/lib/crop';
import type { CropView } from '@/shared/lib/crop';
import { renderAvatarImage } from '@/shared/lib/image';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { FormAlert } from '../FormAlert';
import { Icon } from '../Icon';
import { reportError } from '../toast/store';
import { CropFrame } from './CropFrame';
import { useCropImage } from './useCropImage';
import type { CropViewUpdate, ReadyImage } from './useCropImage';
import styles from './AvatarCrop.module.css';

export interface AvatarCropDialogProps {
  file: File;
  /** 仕上がりの形: 人間は円、エージェントは角丸（--radius-avatar） */
  human: boolean;
  onCancel: () => void;
  /** 切り抜いた画像（256px の正方形の data URL） */
  onConfirm: (avatar: string) => void;
}

/** アバター画像の切り抜き: 作業枠で位置と大きさを決め、実寸のプレビューで仕上がりを確かめる */
export function AvatarCropDialog({ file, human, onCancel, onConfirm }: AvatarCropDialogProps) {
  const { state, update } = useCropImage(file);
  const confirm = () => {
    if (state.status !== 'ready') return;
    try {
      onConfirm(renderAvatarImage(state.image.bitmap, sourceRect(state.view, state.image.size)));
    } catch (error) {
      reportError(error);
    }
  };
  const footer = (
    <>
      <Button onClick={onCancel}>キャンセル</Button>
      <Button variant="primary" onClick={confirm} disabled={state.status !== 'ready'}>
        この範囲で使う
      </Button>
    </>
  );
  return (
    <Dialog title="アバターの範囲を選ぶ" size="sm" onClose={onCancel} footer={footer}>
      {state.status === 'loading' && <p className={styles.help}>画像を読み込んでいます…</p>}
      {state.status === 'error' && <FormAlert>{state.message}</FormAlert>}
      {state.status === 'ready' && <CropEditor image={state.image} view={state.view} update={update} human={human} />}
    </Dialog>
  );
}

interface CropEditorProps {
  image: ReadyImage;
  view: CropView;
  update: CropViewUpdate;
  human: boolean;
}

function CropEditor({ image, view, update, human }: CropEditorProps) {
  const sliderId = useId();
  const helpId = useId();
  const placement: CSSProperties = imagePlacement(view, image.size);
  const zoomText = `${view.zoom.toFixed(1)} 倍`;
  return (
    <div className={styles.editor} data-human={human ? '' : undefined}>
      <div className={styles.stage}>
        <CropFrame url={image.url} size={image.size} placement={placement} update={update} describedBy={helpId} />
        <div className={styles.previews}>
          <span className={styles.previewLabel}>仕上がり</span>
          <span className={styles.preview} data-size="md" aria-hidden="true">
            <img className={styles.image} src={image.url} alt="" draggable={false} style={placement} />
          </span>
          <span className={styles.preview} data-size="sm" aria-hidden="true">
            <img className={styles.image} src={image.url} alt="" draggable={false} style={placement} />
          </span>
        </div>
      </div>
      <div className={styles.zoomRow}>
        <label htmlFor={sliderId} className={styles.zoomLabel}>
          拡大
        </label>
        <input
          id={sliderId}
          className={styles.slider}
          type="range"
          min={CROP_ZOOM_MIN}
          max={CROP_ZOOM_MAX}
          step={0.01}
          value={view.zoom}
          aria-valuetext={zoomText}
          onChange={(event) => {
            const zoom = Number(event.target.value);
            update((current) => zoomViewCentered(current, zoom, image.size));
          }}
        />
        <span className={styles.zoomValue}>{zoomText}</span>
        <Button size="sm" variant="ghost" onClick={() => update(() => initialView(image.size))}>
          <Icon name="refresh" />
          元に戻す
        </Button>
      </div>
      <p id={helpId} className={styles.help}>
        ドラッグか矢印キー（Shift で大きく）で動かし、スライダー・ホイール・+ / − で拡大します。
      </p>
    </div>
  );
}
