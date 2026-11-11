# Claude の外部連携の抑止

Claude の全役割で、アプリが明示した組み込みツールと `mcp__guild__post` だけを使う。
権限を全許可した作業者も対象。`operationCheck` の省略・true・false で解除されない。

## 読み込みと実行の判定

- 通常実行と操作確認用モデルに `strictMcpConfig: true` を渡す。利用者・プロジェクト・プラグイン等の MCP 設定を取り込ませない。
- 両プロセスの環境で `ENABLE_CLAUDEAI_MCP_SERVERS=false` を上書きする。親プロセスの true も継承しない。アカウント側の接続設定は変更しない。
- `fileAccessPolicy` と `checkedPolicy` の先頭で、登録した道具名の一覧と完全一致しない名前を拒否する。
- SDK の事前許可で canUseTool が省かれる呼び出しにも `PreToolUse` を適用し、その実行で渡した道具以外を拒否する。
- フックは通過時に `{}` を返す。パス・権限・操作確認を飛ばす allow は返さない。
- 投稿と同じ名前でも、MCP の出自が `source: sdk, name: guild` でなければフックで拒否する。出自の情報がない古い CLI では投稿も拒否される。名前だけを信頼する例外は作らない。
- 操作確認用モデルは道具を一切許可しない。フックでも全拒否する。

標準の道具一覧は `tool-policy.ts` が管理する。元のパス判定にあった LS・MultiEdit・NotebookEdit は判定関数で引き続き扱うが、SDK に渡す tools は増やさない。
投稿・WebSearch・Skill が canUseTool に届いた場合も、投稿は固定の道具名、それ以外は対応する権限を確認する。

## 根拠と限界

SDK 0.3.319 の sdk.d.ts:2407-2415 に strictMcpConfig、:2854-2869 に実行前フックと拒否の型、:1285-1298 に MCP の出自の説明がある。
公式資料は [SDK が取り込む設定](https://code.claude.com/docs/en/agent-sdk/claude-code-features) と [権限の評価順](https://code.claude.com/docs/en/agent-sdk/permissions)。claude.ai ログインでは連携が自動で加わり、settingSources を空にするだけでは止まらない。

CLI は利用者のものを探して使う（executable.ts）。SDK 同梱の CLI と実際に選ばれる CLI の版は一致するとは限らない。
テストは架空の名前をローカルの判定へ渡す。実際の Gmail 等は呼ばない。実 CLI でのフック実行と、起動後の一覧の確認は別途必要。

この変更の判定入口は Claude 用。Codex は別の config と SDK を使い、このフックを通らない。Codex の Apps/MCP、Web 閲覧、Bash の通信やプロンプトによる持ち出し全体を、この変更で防げるとは扱わない。
