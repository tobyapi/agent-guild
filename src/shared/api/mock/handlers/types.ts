import type { CommandArgs, CommandName, CommandResult } from '../../contract';
import type { MockConversation } from '../conversation/conversation';
import type { MockCore } from '../runtime';

export interface MockRuntime extends MockCore {
  conversation: MockConversation;
}

/** コマンド1つ分の処理。失敗は fail()（CommandError で reject）で表す */
export type MockHandler<C extends CommandName> = (args: CommandArgs<C>, runtime: MockRuntime) => CommandResult<C>;

/** 全コマンドの処理表（コマンドを足して実装を忘れるとコンパイルエラーになる） */
export type MockHandlers = { [C in CommandName]: MockHandler<C> };

export type HandlerGroup<C extends CommandName> = Pick<MockHandlers, C>;

/** 再起動するまでの間（画面に「再起動します」を出す猶予） */
export const RESTART_DELAY_MS = 600;
