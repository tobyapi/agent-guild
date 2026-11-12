// 枠を選ぶ画面の選択肢: 「なし」→ 内蔵の枠 → 生成した枠（作成順）。
import { BUILTIN_FRAMES } from '@/shared/ui';
import type { ResolvedFrame } from '@/shared/ui';
import type { CustomFrameView } from '../store';
import { t } from '../i18n';

export interface FrameChoice {
  /** 保存する ID（'' は枠なし） */
  id: string;
  name: string;
  frame: ResolvedFrame | null;
  /** 生成した枠（消せる） */
  removable: boolean;
  /** 絵を取りに行っている（画像の枠） */
  loading: boolean;
}

const NAME_KEYS = {
  'builtin:oak': 'oak',
  'builtin:harbor': 'harbor',
  'builtin:clockwork': 'clockwork',
  'builtin:teatime': 'teatime',
  'builtin:moth': 'moth',
  'builtin:raven': 'raven',
  'builtin:masquerade': 'masquerade',
  'builtin:astrolabe': 'astrolabe',
} as const;

/** 内蔵の枠の名前（翻訳表になければ ID のまま） */
export function builtinFrameName(id: string): string {
  const key = NAME_KEYS[id as keyof typeof NAME_KEYS];
  return key ? t(key) : id;
}

/**
 * 生成した枠も選択肢にする。消毒に通らない SVG の枠は出さない。画像の枠は、絵を取っている間や取れなかったときも
 * （枠なしの見本で）出して、選んだり消したりできるようにする
 */
export function frameChoices(custom: readonly CustomFrameView[]): FrameChoice[] {
  const none: FrameChoice = { id: '', name: t('none'), frame: null, removable: false, loading: false };
  const builtins = BUILTIN_FRAMES.map((frame): FrameChoice => ({
    id: frame.id,
    name: builtinFrameName(frame.id),
    frame: { kind: 'builtin', id: frame.id },
    removable: false,
    loading: false,
  }));
  const generated = custom.flatMap((frame): FrameChoice[] =>
    frame.src === null && frame.kind === 'svg'
      ? []
      : [
          {
            id: frame.id,
            name: frame.name,
            frame: frame.src === null ? null : { kind: 'custom', src: frame.src },
            removable: true,
            loading: frame.loading,
          },
        ],
  );
  return [none, ...builtins, ...generated];
}

/** 保存した ID から描く枠を決める（知らない内蔵の枠・消えた生成の枠・描けない枠は null = 枠なし） */
export function resolveFrame(id: string, custom: readonly CustomFrameView[]): ResolvedFrame | null {
  if (id === '') return null;
  if (BUILTIN_FRAMES.some((frame) => frame.id === id)) return { kind: 'builtin', id };
  const src = custom.find((frame) => frame.id === id)?.src;
  return src ? { kind: 'custom', src } : null;
}
