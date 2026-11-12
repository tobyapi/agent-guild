// アイコンの枠: 生成（枠の生成を申告する使えるバックエンドだけ。少し待ってから決まった絵の PNG の枠を返す）・
// 画像の読み出し・取り消し・削除。
import { frameDescriptionProblem, frameName, isFrameIdShape } from '@/shared/lib/frames';
import { MOCK_FRAME_PNG } from '../frameArt';
import { emitStateChanged, fail } from '../runtime';
import type { HandlerGroup, MockRuntime } from './types';

/** 生成にかかる擬似的な時間 */
export const FRAME_GENERATION_MS = 1200;

/** 生成中の取り消し（モックの状態ごと） */
const pending = new WeakMap<MockRuntime['state'], Set<() => void>>();

function pendingOf(runtime: MockRuntime): Set<() => void> {
  const found = pending.get(runtime.state) ?? new Set<() => void>();
  pending.set(runtime.state, found);
  return found;
}

/** 選んだ枠の ID を確かめる（Rust の normalize_frame_id と同じ） */
export function checkFrameId(frame: string): string {
  if (!isFrameIdShape(frame)) fail('validation', 'アイコンの枠の指定が正しくありません', 'frame');
  return frame.trim();
}

export const frameHandlers: HandlerGroup<
  'generate_avatar_frame' | 'cancel_avatar_frame_generation' | 'get_frame_image' | 'delete_avatar_frame'
> = {
  generate_avatar_frame({ backendId, description, name }, runtime) {
    const problem = frameDescriptionProblem(description);
    if (problem === 'empty') fail('validation', 'どんな枠にするかを書いてください', 'description');
    if (problem === 'tooLong') fail('validation', '説明は200文字以内にしてください', 'description');
    // Rust の FrameService::drawing_backend と同じ: 枠の生成を申告していて、いま使えるものだけ
    const backend = runtime.state.backends.find((item) => item.id === backendId);
    if (backend && !backend.frameGeneration) {
      fail('validation', 'このバックエンドではアイコンの枠を生成できません', 'backendId');
    }
    if (backend?.status !== 'ready') fail('validation', 'このバックエンドはいま使える状態ではありません', 'backendId');
    const jobs = pendingOf(runtime);
    return new Promise((resolve, reject) => {
      const cancel = () => {
        stop();
        jobs.delete(cancel);
        try {
          fail('runtime', '枠の生成を取り消しました');
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      const stop = runtime.env.schedule(FRAME_GENERATION_MS, () => {
        jobs.delete(cancel);
        const frame = {
          id: `custom:${runtime.env.newId()}`,
          name: frameName(name, description),
          kind: 'png' as const,
          createdAt: runtime.env.now(),
        };
        runtime.state.frames.push(frame);
        emitStateChanged(runtime);
        resolve(frame);
      });
      jobs.add(cancel);
    });
  },

  cancel_avatar_frame_generation(_args, runtime) {
    for (const cancel of [...pendingOf(runtime)]) cancel();
    return null;
  },

  /** Rust の FrameService::image と同じ: 画像の枠だけ。ほかは not_found */
  get_frame_image({ id }, runtime) {
    const frame = runtime.state.frames.find((item) => item.id === id);
    if (frame?.kind !== 'png') fail('not_found', 'アイコンの枠の画像が見つかりません');
    return MOCK_FRAME_PNG;
  },

  delete_avatar_frame({ id }, runtime) {
    const { state } = runtime;
    if (!state.frames.some((frame) => frame.id === id)) fail('not_found', 'アイコンの枠が見つかりません');
    state.frames = state.frames.filter((frame) => frame.id !== id);
    for (const agent of state.agents) if (agent.frame === id) agent.frame = '';
    if (state.me.frame === id) state.me = { ...state.me, frame: '' };
    emitStateChanged(runtime);
    return null;
  },
};
