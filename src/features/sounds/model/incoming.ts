// 届いた発言で音を鳴らすかの判定（純粋な関数。音を出すのは audio/）。
// 鳴らすのはエージェントの会話（chat・自発）だけ。自分の発言・システムのお知らせ・途中経過・エラーは鳴らさない。
// 過去の発言の読み込み（ページング）は message-created を通らないので、ここに来るのはライブで届いた発言だけ。
import { parseMentions } from '@/shared/lib/mentions';
import { HUMAN_ID, SYSTEM_ID } from '@/shared/types/domain';
import type { Message, MessageKind } from '@/shared/types/domain';
import type { SoundName, SoundPreferences } from './preferences';

const SOUNDING_KINDS: ReadonlySet<MessageKind> = new Set<MessageKind>(['chat', 'autonomous']);

/** ふつうの返信が続けて届いたときに鳴らし直さない間隔（何人も続けて返信しても、うるさくしない。自分宛ては必ず鳴らす） */
export const MIN_SOUND_GAP_MS = 1500;

export interface IncomingContext {
  /** 自分（人間）のプロフィールの名前（メンションの判定に使う） */
  myName: string;
  /** ウィンドウにフォーカスがあるか */
  focused: boolean;
  /** 前に鳴らしてからの時間（ミリ秒。まだ鳴らしていなければ Infinity） */
  sinceLastMs: number;
}

/** 自分（人間）がメンションされているか（chat の mentionsHuman と同じ規則） */
export function mentionsMe(message: Message, myName: string): boolean {
  if (myName === '') return false;
  return parseMentions(message.content, [{ id: HUMAN_ID, name: myName }]).length > 0;
}

/** 鳴らす音。鳴らさないなら null。自分宛ての音が「なし」なら、ふつうの返信の音で鳴らす */
export function soundForMessage(
  message: Message,
  preferences: SoundPreferences,
  context: IncomingContext,
): SoundName | null {
  if (message.authorId === HUMAN_ID || message.authorId === SYSTEM_ID) return null;
  if (!SOUNDING_KINDS.has(message.kind)) return null;
  if (preferences.volume <= 0) return null;
  if (preferences.onlyWhenUnfocused && context.focused) return null;
  if (mentionsMe(message, context.myName) && preferences.mention !== 'off') return preferences.mention;
  if (context.sinceLastMs < MIN_SOUND_GAP_MS) return null;
  return preferences.message === 'off' ? null : preferences.message;
}
