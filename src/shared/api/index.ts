// バックエンド呼び出しの入口。import してよいのは各 feature の api.ts と app/ だけ。
// 失敗の判定（code で分岐）は @/shared/lib/errors の errorCode / errorMessage を使う。
export { invoke, listen } from './client';
export { EVENT_NAMES } from './contract';
export type { CommandArgs, CommandName, CommandResult, EventName, EventPayload, SkillsChanged } from './contract';
export type { Unlisten } from './transport';
