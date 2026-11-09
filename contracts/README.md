# 契約の実例（ゴールデンフィクスチャ）

- `ipc/*.json` … React ⇄ Rust の値の実例（型の正は `src/shared/types/domain/`）。
  - Rust: guild-domain のテストが各ファイルを対応する型に読み込み、書き戻した JSON が元と**値として一致**することを検査する。
    さらに `snapshot.json` の `templates` は guild-domain のテンプレート表と説明文まで含めて完全に一致すること。
  - TS: vitest のテストが各ファイルを読み、対応する型に `satisfies` で合うことを検査する。
- `runner/*.jsonl` … Rust ⇄ ランナーのプロトコルの実例（型の正は `agent-runner/src/protocol.ts`）。1行1メッセージ。
  - runner-client と agent-runner の両方のテストが同じファイルを読む。

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
| runner/requests.jsonl | RunnerRequest（run / cancel / probe / shutdown） |
| runner/events.jsonl | RunnerEvent（ready / backends / activity / result / error）。ready の BackendInfo は permissionRules を含む |

契約を変えたら、この表とフィクスチャを同じ変更で直すこと。
