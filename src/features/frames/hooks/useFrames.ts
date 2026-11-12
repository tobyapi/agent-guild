import { useMemo } from 'react';
import { useLanguage } from '@/shared/i18n';
import type { ResolvedFrame } from '@/shared/ui';
import { frameChoices, resolveFrame } from '../model/catalog';
import type { FrameChoice } from '../model/catalog';
import { useFramesStore } from '../store';

/** 保存した枠の ID から、描く枠（なければ null） */
export function useResolvedFrame(frameId: string): ResolvedFrame | null {
  const custom = useFramesStore((state) => state.custom);
  return useMemo(() => resolveFrame(frameId, custom), [frameId, custom]);
}

/** 枠を選ぶ画面の選択肢（言語が変わると名前も変わる） */
export function useFrameChoices(): FrameChoice[] {
  const custom = useFramesStore((state) => state.custom);
  const language = useLanguage();
  return useMemo(() => {
    void language;
    return frameChoices(custom);
  }, [custom, language]);
}
