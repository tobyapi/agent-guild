// 通知の音を鳴らす（Web Audio）。AudioContext は最初に使うときに作り、操作（クリック・キー）があれば再開する。
// 音が出せない環境（AudioContext がない・止められている）では何もしない（通知の音は失敗しても知らせない）。
import type { SoundName } from '../model/preferences';
import { VOICES } from './voices';
import type { Tone } from './voices';

/** 音量 1 のときの全体の大きさ（UI の音と並んでも驚かない大きさ） */
const MASTER_GAIN = 0.35;
const ATTACK_S = 0.008;
const SILENT = 0.0001;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  try {
    const Context = typeof window === 'undefined' ? undefined : window.AudioContext;
    context = Context ? new Context() : null;
  } catch {
    context = null;
  }
  return context;
}

function resume(ctx: AudioContext): void {
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
}

function schedule(ctx: AudioContext, destination: AudioNode, tone: Tone, start: number): number {
  const begin = start + tone.at;
  const end = begin + tone.decay;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.freq, begin);
  if (tone.endFreq !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(tone.endFreq, begin + (tone.glide ?? tone.decay));
  }
  envelope.gain.setValueAtTime(SILENT, begin);
  envelope.gain.exponentialRampToValueAtTime(tone.gain, begin + ATTACK_S);
  envelope.gain.exponentialRampToValueAtTime(SILENT, end);
  oscillator.connect(envelope).connect(destination);
  oscillator.start(begin);
  oscillator.stop(end + 0.02);
  return end;
}

/** 音を1回鳴らす（volume は 0〜1）。失敗しても例外を出さない */
export function playSound(name: SoundName, volume: number): void {
  const ctx = audioContext();
  if (!ctx || volume <= 0) return;
  try {
    resume(ctx);
    const master = ctx.createGain();
    master.gain.value = Math.min(1, volume) * MASTER_GAIN;
    master.connect(ctx.destination);
    const start = ctx.currentTime + 0.01;
    const ends = VOICES[name].map((tone) => schedule(ctx, master, tone, start));
    const last = Math.max(...ends);
    window.setTimeout(() => master.disconnect(), (last - ctx.currentTime + 0.2) * 1000);
  } catch {
    // 音が出せなくても、ほかの動作は続ける
  }
}

const GESTURES = ['pointerdown', 'keydown'] as const;

/**
 * 起動時に1回: 最初の操作で AudioContext を用意・再開しておく（ブラウザやWebViewは、操作の前の再生を止めることがある）。
 * 操作のあとに止められた（スリープ明けなど）場合も、次の操作で再開する。
 */
export function unlockAudioOnGesture(wanted: () => boolean): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    // 音を使わない設定なら AudioContext を作らない
    const ctx = context ?? (wanted() ? audioContext() : null);
    if (ctx) resume(ctx);
  };
  GESTURES.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));
}
