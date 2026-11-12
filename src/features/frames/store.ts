import { create } from 'zustand';
import { frameImageSource } from '@/shared/lib/frameSvg';
import type { CustomFrame } from '@/shared/types/domain';
import { framesApi } from './api';

/**
 * 生成した枠の表示用。src は描ける絵の data URL（SVG の枠は消毒したもの、PNG の枠は Rust から取ったもの）。
 * 描けなければ null。loading は PNG の枠の絵を取りに行っている間だけ true
 */
export interface CustomFrameView {
  id: string;
  name: string;
  createdAt: number;
  kind: CustomFrame['kind'];
  src: string | null;
  loading: boolean;
}

interface FramesStoreState {
  custom: CustomFrameView[];
}

export const useFramesStore = create<FramesStoreState>()(() => ({ custom: [] }));

/** 消毒の結果は SVG ごとに覚えておく（スナップショットのたびに消毒し直さない） */
const svgSources = new Map<string, string | null>();
/** PNG の枠の絵（枠の ID ごと。同じ ID の絵は変わらないので、取れたら覚えておく。取れなければ次の機会に取り直す） */
const pngSources = new Map<string, string>();
/** いま絵を取りに行っている枠の ID */
const fetching = new Set<string>();

function svgSource(svg: string): string | null {
  if (!svgSources.has(svg)) svgSources.set(svg, frameImageSource(svg));
  return svgSources.get(svg) ?? null;
}

function viewOf(frame: CustomFrame): CustomFrameView {
  const { id, name, createdAt, kind } = frame;
  if (frame.kind === 'svg') return { id, name, createdAt, kind, src: svgSource(frame.svg), loading: false };
  const src = pngSources.get(id) ?? null;
  return { id, name, createdAt, kind, src, loading: src === null };
}

function settle(id: string, src: string | null): void {
  fetching.delete(id);
  if (src !== null) pngSources.set(id, src);
  useFramesStore.setState(({ custom }) => ({
    custom: custom.map((view) => (view.id === id ? { ...view, src, loading: false } : view)),
  }));
}

/** まだ絵のない PNG の枠の絵を取りに行く（届いたら一覧を更新する） */
function loadImages(frames: readonly CustomFrame[]): void {
  for (const { id, kind } of frames) {
    if (kind !== 'png' || pngSources.has(id) || fetching.has(id)) continue;
    fetching.add(id);
    framesApi.image(id).then(
      (src) => settle(id, src),
      () => settle(id, null),
    );
  }
}

export function applyFramesSnapshot(frames: readonly CustomFrame[]): void {
  useFramesStore.setState({ custom: frames.map(viewOf) });
  loadImages(frames);
}

/** 生成を頼み、終わったら一覧に足す（state-changed でも取り直される） */
export async function generateFrame(backendId: string, description: string, name: string): Promise<CustomFrameView> {
  const frame = await framesApi.generate(backendId, description, name);
  const view = viewOf(frame);
  useFramesStore.setState(({ custom }) => ({
    custom: custom.some((existing) => existing.id === view.id) ? custom : [...custom, view],
  }));
  loadImages([frame]);
  return view;
}

export function cancelFrameGeneration(): Promise<null> {
  return framesApi.cancelGeneration();
}

export async function removeFrame(id: string): Promise<void> {
  await framesApi.remove(id);
  pngSources.delete(id);
  useFramesStore.setState(({ custom }) => ({ custom: custom.filter((frame) => frame.id !== id) }));
}
