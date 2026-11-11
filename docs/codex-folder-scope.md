# Codex 系の指定フォルダ（Windows）

指定フォルダのチャンネル（design.md「チャンネルの作業範囲」）を、Codex・Grok・Muse（同じ Codex CLI で動く）でも使えるようにした。使えるのは、OS の隔離（MXC。command-sandbox.md）が使える Windows 11。それ以外の PC では、理由を示して実行を止める。

## 守り方

Ollama は、ファイルの道具ごとにパスを確かめてから読み書きする。Codex はファイルの読み書きもシェルで行うので、道具ごとには止められない。そのかわり、**シェルとその子プロセスを OS の隔離に入れ、読める場所・書ける場所・通信を Codex の権限プロファイルで決める**（`agent-runner/src/backends/codex-runtime/folder-profile.ts`）。

| | 内容 |
|---|---|
| 読み書きできる | チャンネル専用の作業場所と、割り当てフォルダ |
| 読み取りだけ | 相談相手の成果物、チャンネルの添付、道具のフォルダ（PATH にあるもの）、Windows の部品（Codex の `:minimal`） |
| 読めない | 相談相手の `MEMORY.md`（まだなくても拒否に入れる）、ほかのすべて（利用者のホームも）。一時フォルダにも書けない |
| 通信 | Web 閲覧（webFetch）の権限があるときだけ開く |

Ollama との違い:

- **コマンドを使える**。コマンドも同じ範囲の中でだけ動くので、Rust は Codex 系ではコマンドの権限を外さない（`request_scope.rs` の `FolderSupport::Sandbox`）。PC 全体の読み書きとスキルは、Ollama と同じく外す。
- **スキルは使えない**。利用者全体のスキルの場所（`~/.codex`）は、範囲の外なのでシェルから読めない。

設定は、利用者の `~/.codex/config.toml` を書き換えずに、起動時の上書き（`--config`）で渡す:

```toml
windows.sandbox = "mxc"
default_permissions = "guild_folder"

[permissions.guild_folder.filesystem]
":minimal" = "read"
'C:\...\work' = "write"        # チャンネル専用の作業場所
'D:\project' = "write"         # 割り当てフォルダ
'C:\...\peer\work' = "read"    # 相談相手の成果物
'C:\...\peer\work\MEMORY.md' = "none"

[permissions.guild_folder.network]
enabled = false
```

権限プロファイルは `sandbox_mode` と併用できないので、指定フォルダのときは sandbox の指定（`--sandbox`）とネットワークの指定を渡さない。パスは表のキーになるので、表ごとインラインの形で渡す（Codex SDK の `configOverrides`）。

## この PC で確かめたこと（2026-11-12、Windows 11 25H2 ビルド 26200.9711、Codex CLI 0.163）

`codex sandbox`（モデルは呼ばない。自動テスト `codex-runtime/folder-profile.test.ts`。Codex と隔離がない PC では飛ばす）:

- 割り当てフォルダと相談相手の成果物は読め、相談相手の `MEMORY.md`・範囲の外・利用者のホームの設定ファイルは読めない。範囲の外は一覧もできない。
- 作業場所と割り当てフォルダには書け、相談相手のフォルダ・範囲の外・一時フォルダには書けない。
- 外部への TCP 接続はできない。

実際の Codex（モデルを呼ぶ通しの実行。ランナーの `runCodex` 経由、発想役に当たる権限）:

- モデルが実行したコマンドで、上と同じ結果になった。
- ファイル編集の道具（apply_patch）で、割り当てフォルダへの作成は成功し、範囲の外への作成は `writing outside of the project` で拒否された。

## 分かっている制約

- **ハードリンクは止められない**: 割り当てフォルダの中に、範囲の外のファイルへのハードリンクがあると、その中身を読み書きできる（OS の隔離は名前で範囲を決めるため）。エージェント自身は範囲の外のファイルにリンクを張れないので、利用者やほかのプログラムが置いたリンクに限られる。pnpm のようにハードリンクを多用する道具があるので、実行の前に調べて断ることはしていない。Ollama は、道具ごとにリンク数を確かめて断る。
- **Codex 自身は隔離の外で動く**: 閉じ込めるのは、モデルが動かすコマンドとファイル編集。Codex のプロセスは、認証やセッションのために利用者のホームを読み書きする。添付の画像は Codex が直接読む。
- **macOS・Linux では使えない**: Codex の権限プロファイルは macOS・Linux にもあるが、確かめていないので実行を止める。
- **Grok・Muse は、Rust とランナーの経路が同じというだけで、実際のモデルでは確かめていない**。隔離は同じ Codex CLI が行う。
- **指定フォルダ以外のチャンネルでは、Codex 系の読み取りは絞っていない**（role-permissions.md の「残る差」）。同じ権限プロファイルで絞れる見込み。
- 配布アプリの画面からの操作では確かめていない。
