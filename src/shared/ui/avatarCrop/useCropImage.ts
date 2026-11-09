import { useCallback, useEffect, useState } from 'react';
import { initialView } from '@/shared/lib/crop';
import type { CropView, ImageSize } from '@/shared/lib/crop';
import { errorMessage } from '@/shared/lib/errors';
import { loadAvatarImage } from '@/shared/lib/image';

export interface ReadyImage {
  /** 書き出しに使う（GIF は 1 コマ目） */
  bitmap: ImageBitmap;
  /** 表示に使う（object URL） */
  url: string;
  size: ImageSize;
}

export type CropImageState = { status: 'loading' } | { status: 'ready'; image: ReadyImage; view: CropView } | { status: 'error'; message: string };

/** 切り抜きの状態を更新する（連続するドラッグで値を取りこぼさないよう、いまの値から次の値を作る関数を渡す） */
export type CropViewUpdate = (next: (view: CropView) => CropView) => void;

/** 選んだファイルを読み、切り抜きの状態（中央・最小倍率から始める）を持つ。外れるときに画像を手放す */
export function useCropImage(file: File): { state: CropImageState; update: CropViewUpdate } {
  const [state, setState] = useState<CropImageState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    let loaded: ReadyImage | null = null;
    loadAvatarImage(file).then(
      (bitmap) => {
        const image = { bitmap, url: URL.createObjectURL(file), size: { width: bitmap.width, height: bitmap.height } };
        if (!active) return release(image);
        loaded = image;
        setState({ status: 'ready', image, view: initialView(image.size) });
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => {
      active = false;
      if (loaded) release(loaded);
    };
  }, [file]);

  const update: CropViewUpdate = useCallback(
    (next) => setState((current) => (current.status === 'ready' ? { ...current, view: next(current.view) } : current)),
    [],
  );
  return { state, update };
}

function release(image: ReadyImage): void {
  image.bitmap.close();
  URL.revokeObjectURL(image.url);
}
