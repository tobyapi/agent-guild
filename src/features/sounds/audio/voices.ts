// 通知の音の音色（Web Audio で合成する。音のファイルは持たない）。どれも短く（1.2 秒以内）、耳に痛い高音は避ける。
import type { SoundName } from '../model/preferences';

/** 1つの音（正弦波などの短い発音） */
export interface Tone {
  type: OscillatorType;
  /** 鳴りはじめの周波数（Hz） */
  freq: number;
  /** 指定すると、鳴りはじめから glide 秒でこの周波数まで滑らせる */
  endFreq?: number;
  glide?: number;
  /** 鳴りはじめ（秒。音全体の頭から） */
  at: number;
  /** 減衰して消えるまで（秒） */
  decay: number;
  /** 相対の大きさ 0〜1 */
  gain: number;
}

export const VOICES: Readonly<Record<SoundName, readonly Tone[]>> = {
  // チャイム: 2音で上がる（E5 → A5）。柔らかい正弦波
  chime: [
    { type: 'sine', freq: 659.25, at: 0, decay: 0.5, gain: 0.7 },
    { type: 'sine', freq: 880, at: 0.12, decay: 0.7, gain: 0.6 },
  ],
  // ベル: 基音と金属的な倍音（非整数倍）を長めに響かせる
  bell: [
    { type: 'sine', freq: 784, at: 0, decay: 1.2, gain: 0.6 },
    { type: 'sine', freq: 784 * 2.76, at: 0, decay: 0.5, gain: 0.18 },
    { type: 'sine', freq: 784 * 5.4, at: 0, decay: 0.25, gain: 0.06 },
  ],
  // ポン: 高さが素早く下がる短い泡の音
  pop: [{ type: 'sine', freq: 900, endFreq: 380, glide: 0.07, at: 0, decay: 0.14, gain: 0.9 }],
  // 木: 拍子木のような乾いた2打
  wood: [
    { type: 'triangle', freq: 1040, at: 0, decay: 0.09, gain: 0.8 },
    { type: 'triangle', freq: 780, at: 0.11, decay: 0.1, gain: 0.7 },
  ],
};
