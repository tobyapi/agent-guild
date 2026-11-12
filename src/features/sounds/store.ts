// 通知の音の好みの保持（localStorage。使えない環境では保存せずに、この起動のあいだだけ使う）と、届いた発言で鳴らす入口。
import { create } from 'zustand';
import type { Message } from '@/shared/types/domain';
import { playSound, unlockAudioOnGesture } from './audio/player';
import { soundForMessage } from './model/incoming';
import { parseSoundPreferences, serializeSoundPreferences, SOUND_STORAGE_KEY } from './model/preferences';
import type { SoundName, SoundPreferences } from './model/preferences';

export const useSoundStore = create<{ preferences: SoundPreferences }>()(() => ({
  preferences: parseSoundPreferences(readStored()),
}));

let lastPlayedAt = Number.NEGATIVE_INFINITY;

function readStored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(SOUND_STORAGE_KEY);
  } catch {
    return null;
  }
}

function windowFocused(): boolean {
  return typeof document !== 'undefined' && document.hasFocus();
}

function hasAnySound({ message, mention, volume }: SoundPreferences): boolean {
  return volume > 0 && (message !== 'off' || mention !== 'off');
}

/** 起動時に1回: 最初の操作で音の準備をしておく（音を使う設定のときだけ） */
export function initSounds(): void {
  unlockAudioOnGesture(() => hasAnySound(useSoundStore.getState().preferences));
}

export function setSoundPreferences(patch: Partial<SoundPreferences>): void {
  const preferences = { ...useSoundStore.getState().preferences, ...patch };
  useSoundStore.setState({ preferences });
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, serializeSoundPreferences(preferences));
  } catch {
    // 保存できなくても、この起動のあいだは使える
  }
}

/** 試聴: 設定に関係なく、いまの音量で1回鳴らす */
export function previewSound(name: SoundName): void {
  playSound(name, useSoundStore.getState().preferences.volume);
}

/** message-created で届いた発言に、設定に合えば音を鳴らす（myName は自分のプロフィールの名前） */
export function playMessageSound(message: Message, myName: string): void {
  const { preferences } = useSoundStore.getState();
  const now = Date.now();
  const sound = soundForMessage(message, preferences, {
    myName,
    focused: windowFocused(),
    sinceLastMs: now - lastPlayedAt,
  });
  if (sound === null) return;
  lastPlayedAt = now;
  playSound(sound, preferences.volume);
}
