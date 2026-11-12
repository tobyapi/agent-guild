// 枠を描けるバックエンドの選り分け。バックエンドの ID では分岐せず、申告（BackendInfo.frameGeneration）だけを見る。
import type { BackendInfo } from '@/shared/types/domain';

/** 枠の生成を申告するバックエンドがあるか（1つもなければ、生成の操作を出さない） */
export function offersFrameGeneration(backends: readonly BackendInfo[]): boolean {
  return backends.some((backend) => backend.frameGeneration);
}

/** いま枠を描ける（枠の生成を申告していて、status が ready の）バックエンド */
export function drawingBackends(backends: readonly BackendInfo[]): BackendInfo[] {
  return backends.filter((backend) => backend.frameGeneration && backend.status === 'ready');
}
