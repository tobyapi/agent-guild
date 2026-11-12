// 発言へ移って一度だけ光らせる（タスクのカードの「結果を見る」「まとめを見る」、見出しの「↩ 割り振りの結果」から）。
// 光らせ方は docs/ui-design.md §5.13: 地を --accent-soft にしてから --duration-slow で戻す（CSS の transition。keyframes は使わない）
import { create } from 'zustand';
import { notifyInfo } from '@/shared/ui';
import { t } from './i18n';

/** 光った地を見せておく時間と、戻ったあとに印を外すまでの時間（ms） */
const GLOW_MS = 700;
const FADE_MS = 700;

/** on: 地を光らせた / fade: 戻している（transition で --duration-slow） */
export type HighlightPhase = 'on' | 'fade';

interface JumpState {
  highlight: { messageId: string; phase: HighlightPhase } | null;
}

export const useJumpStore = create<JumpState>()(() => ({ highlight: null }));

const timers: Array<ReturnType<typeof setTimeout>> = [];

/** 発言の要素の id（スクロール先を探す） */
export function messageElementId(messageId: string): string {
  return `message-${messageId}`;
}

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** その発言までスクロールして光らせる。まだ読み込んでいない発言なら、その旨を知らせる */
export function jumpToMessage(messageId: string): void {
  const element = document.getElementById(messageElementId(messageId));
  if (!element) {
    notifyInfo(t('notLoaded'));
    return;
  }
  element.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  timers.splice(0).forEach(clearTimeout);
  useJumpStore.setState({ highlight: { messageId, phase: 'on' } });
  timers.push(
    setTimeout(() => useJumpStore.setState({ highlight: { messageId, phase: 'fade' } }), GLOW_MS),
    setTimeout(() => useJumpStore.setState({ highlight: null }), GLOW_MS + FADE_MS),
  );
}
