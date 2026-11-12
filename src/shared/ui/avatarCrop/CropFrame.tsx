import { useEffect, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react';
import {
  CROP_FRAME_SIZE,
  cropKeyAction,
  panView,
  wheelZoomFactor,
  zoomView,
  zoomViewCentered,
} from '@/shared/lib/crop';
import type { ImageSize } from '@/shared/lib/crop';
import type { CropViewUpdate } from './useCropImage';
import styles from './AvatarCrop.module.css';
import { t } from '../i18n';

export interface CropFrameProps {
  url: string;
  size: ImageSize;
  /** imagePlacement の結果（枠に対するパーセント） */
  placement: CSSProperties;
  update: CropViewUpdate;
  describedBy: string;
}

interface Drag {
  pointerId: number;
  x: number;
  y: number;
}

/** 画面の px を枠の px にする係数（表示が縮んでいても計算は CROP_FRAME_SIZE で行う） */
const frameRatio = (element: HTMLElement) => CROP_FRAME_SIZE / element.getBoundingClientRect().width;

/** 正方形の作業枠: ドラッグ（マウス・タッチ）で動かし、ホイールでカーソルの位置を中心に拡大、矢印と + / − でも操作できる */
export function CropFrame({ url, size, placement, update, describedBy }: CropFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  useWheelZoom(frameRef, size, update);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    const ratio = frameRatio(event.currentTarget);
    const dx = (event.clientX - drag.x) * ratio;
    const dy = (event.clientY - drag.y) * ratio;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    update((view) => panView(view, dx, dy, size));
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = cropKeyAction(event.key, event.shiftKey);
    if (!action) return;
    event.preventDefault();
    if (action.type === 'pan') update((view) => panView(view, action.dx, action.dy, size));
    else update((view) => zoomViewCentered(view, view.zoom * action.factor, size));
  };

  return (
    <div
      ref={frameRef}
      className={styles.frame}
      style={{ '--crop-frame-size': `${CROP_FRAME_SIZE}px` } as CSSProperties}
      tabIndex={0}
      role="group"
      aria-roledescription={t('cropArea')}
      aria-label={t('cropArea')}
      aria-describedby={describedBy}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <img className={styles.image} src={url} alt="" draggable={false} style={placement} />
      <span className={styles.mask} />
    </div>
  );
}

/** ホイールでカーソルの位置を中心に拡大する（ダイアログがスクロールしないよう passive: false で受ける） */
function useWheelZoom(ref: RefObject<HTMLDivElement | null>, size: ImageSize, update: CropViewUpdate): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const ratio = CROP_FRAME_SIZE / rect.width;
      const point = { x: (event.clientX - rect.left) * ratio, y: (event.clientY - rect.top) * ratio };
      // 行単位で届く環境（Firefox など）は px に直す
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      update((view) => zoomView(view, view.zoom * wheelZoomFactor(delta), point, size));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [ref, size, update]);
}
