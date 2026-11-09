# 契約の実例（ゴールデンフィクスチャ）

- `ipc/*.json` … React ⇄ Rust の値の実例（型の正は `src/shared/types/domain/`）。
  - Rust: guild-domain のテストが各ファイルを対応する型に読み込み、書き戻した JSON が元と**値として一致**することを検査する。
    さらに `snapshot.json` の `templates` は guild-domain のテンプレート表と説明文まで含めて完全に一致すること。
  - TS: vitest のテストが各ファイルを読み、対応する型に `satisfies` で合うことを検査する。
- `runner/*.jsonl` … Rust ⇄ ランナーのプロトコルの実例（型の正は `agent-runner/src/protocol.ts`）。1行1メッセージ。
  - runner-client と agent-runner の両方のテストが同じファイルを読む。
- `behavior/*.json` … Rust と TS の両方に実装がある規則の実例（入力と、期待する結果）。正は Rust の guild-domain で、
  TS 側（画面の `src/shared/lib/` と、ブラウザ用のモック `src/shared/api/mock/`）が同じ結果を出すことを検査する。
  - Rust: guild-domain のテスト（`tests/domain/behavior.rs`）が各例を実行し、結果が一致することを検査する。
  - TS: vitest のテスト（`*.behavior.test.ts` と `mock/notices.test.ts`）が同じファイルを読んで同じ検査をする。

| ファイル | 型 |
|---|---|
| ipc/snapshot.json | Snapshot |
| ipc/agent-input.json | AgentInput |
| ipc/messages.json | Message[] |
| ipc/skill.json / ipc/skill-linked.json / ipc/skill-input.json | Skill（アプリ内）/ Skill（ライブラリにリンク）/ SkillInput |
| ipc/skill-library.json | SkillLibrary |
| ipc/delegation.json | Delegation（list_delegations の要素・delegation-changed のペイロード） |
| ipc/activity-state.json | ActivityState（activity-changed のペイロード） |
| ipc/skills-changed.json | { agentId }（skills-changed のペイロード） |
| ipc/storage-info.json | StorageInfo |
| ipc/boot-status-recovery.json | BootStatus |
| ipc/command-error.json | CommandError（validation の例。field はどの入力のことか） |
| runner/requests.jsonl | RunnerRequest（run / login / cancel / probe / shutdown / apiKey） |
| runner/events.jsonl | RunnerEvent（ready / backends / activity / post / result / error）。ready の BackendInfo は permissionRules と midRunPost を含む |

| behavior/mentions.json | メンション解析（design.md §8）: エージェントと本文 → 呼ばれた相手の ID。Rust `parse_mentions` / TS `parseMentions` |
| behavior/tasks.json・behavior/tasks-agents.json | tasks ブロックの読み取り（design.md §7.1）: 本文 → サブタスク・割り振れなかった名前・上限を超えた名前（ブロックがなければ null）。Rust `parse_tasks` / TS `parseTasks`・`findTasksBlock` |
| behavior/notices.json | システム発言と注記の文面。Rust `conversation::notices`・`delegation` の理由 / TS `mock/notices.ts` |

契約を変えたら、この表とフィクスチャを同じ変更で直すこと。規則（メンション・tasks ブロック・お知らせの文面）を変えたら、
`behavior/` の実例と、Rust・TS の両方の実装を同じ変更で直すこと。
