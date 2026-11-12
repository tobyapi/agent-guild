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
| ipc/snapshot.json | Snapshot（エージェントと me の frame、生成したアイコンの枠 frames を含む。frames の要素は generate_avatar_frame の戻り値 CustomFrame と同じ形。kind が svg なら svg を持ち、png なら絵は get_frame_image で取る） |
| ipc/agent-input.json | AgentInput |
| ipc/messages.json | Message[] |
| ipc/skill.json / ipc/skill-linked.json / ipc/skill-builtin.json / ipc/skill-input.json | Skill（アプリ内）/ Skill（ライブラリにリンク）/ Skill（内蔵スキルを参照）/ SkillInput |
| ipc/builtin-skills.json | BuiltinSkill[]（list_builtin_skills） |
| ipc/skill-library.json | SkillLibrary |
| ipc/delegation.json | Delegation（list_delegations の要素・delegation-changed のペイロード） |
| ipc/activity-state.json | ActivityState（activity-changed のペイロード） |
| ipc/skills-changed.json | { agentId }（skills-changed のペイロード） |
| ipc/storage-info.json | StorageInfo |
| ipc/update-status.json | UpdateStatus（check_update） |
| ipc/boot-status-recovery.json | BootStatus |
| ipc/command-error.json | CommandError（validation の例。field はどの入力のことか） |
| runner/requests.jsonl | RunnerRequest（run / image / login / cancel / probe / setLanguage / shutdown / apiKey） |
| runner/events.jsonl | RunnerEvent（ready / backends / activity / post / result / error）。ready の BackendInfo は permissionRules・midRunPost と、バックエンドごとの違いの申告（folderScope・toolsOption・local・frameGeneration・setup）を含む |

| behavior/mentions.json | メンション解析（design.md §8）: エージェントと本文 → 呼ばれた相手の ID。Rust `parse_mentions` / TS `parseMentions` |
| behavior/tasks.json・behavior/tasks-agents.json | tasks ブロックの読み取り（design.md §7.1）: 本文 → サブタスク・割り振れなかった名前・上限を超えた名前（ブロックがなければ null）。Rust `parse_tasks` / TS `parseTasks`・`findTasksBlock` |
| behavior/notices.json | システム発言と注記の文面（言語のコードごと: `{ "ja": {...}, "en": {...}, ... }`）。Rust `conversation::notices`・`delegation::SubtaskNote` / TS `mock/notices.ts` |
| behavior/channel-icons.json | チャンネルのアイコンの規則: 入力 → 正規化したアイコン（空は「なし」）、不正なら null。Rust `normalize_channel_icon`（`tests/domain/channel_icon.rs`）/ TS `normalizeChannelIcon`（`shared/lib/channelIcon.ts`。画面とモック） |

契約を変えたら、この表とフィクスチャを同じ変更で直すこと。規則（メンション・tasks ブロック・お知らせの文面）を変えたら、
`behavior/` の実例と、Rust・TS の両方の実装を同じ変更で直すこと。

`behavior/role-permissions.json` は、役割で決まる権限（`permissions`。同じ役割ならどのバックエンドでも同じ）と、そのバックエンドで実際に使える操作（`usable`。権限の部分集合）の共有実例。Rust の保存・実行、ランナーの絞り込み、TypeScript の編集画面で同じ結果を検査する。
