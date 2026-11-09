// ドメイン型（React ⇄ Rust の IPC 契約）。Rust は serde(rename_all = "camelCase") で同じ JSON を返す。
// 実例は contracts/ipc/*.json（ゴールデンフィクスチャ。両言語のテストが一致を検査する）。
// 変更するときは docs/design.md・フィクスチャ・Rust の guild-domain を同時に直すこと。
// 利用側は必ず `@/shared/types/domain` から import する（ファイル単位の分割は内部の都合）。

export * from './ids';
export * from './permissions';
export * from './agent';
export * from './skill';
export * from './conversation';
export * from './delegation';
export * from './backend';
export * from './activity';
export * from './system';
