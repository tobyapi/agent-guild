# Windows のコード署名（SignPath）

Windows のインストーラーに、[SignPath Foundation](https://signpath.org/) の無料の証明書でコード署名する。署名は SignPath.io のサービスが行い、秘密鍵は手元にも GitHub にも置かない。

## 流れ

`build.yml` の Windows のジョブで、ビルドの後に次を行う（設定がそろっていないときは警告を出して飛ばす）。

1. 署名前のインストーラー（`*-setup.exe`）を、zip にせず GitHub の成果物に置く。
2. `signpath/github-action-submit-signing-request` で署名を依頼する。SignPath は GitHub から成果物を取りに行き、どのリポジトリ・ワークフローでビルドしたかを GitHub から確かめる（Origin Verification）。
3. 署名済みのものに置き換え、自動アップデート用の署名（`*.exe.sig`）を作り直す（中身が変わるので、ビルド時の `.sig` は合わなくなる）。
4. Authenticode の署名が付いたことを確かめる。

- **署名のポリシー**: `v*` のタグは `release-signing`（本番の証明書。承認者が SignPath の画面で承認するまで最大1時間待つ）、手動実行は `test-signing`（テスト用の証明書。OS は信頼しない）。
- **署名する範囲**: インストーラーだけ。インストーラーの中のアプリ本体（`agent-guild.exe`）は署名しない（ビルドの途中で SignPath に渡す手段がないため）。同梱の Node.js と `wxc-exec.exe` は、それぞれの配布元の署名のまま。
- **製品名と版の制限**: SignPath の条件に合わせ、製品名 `agent-guild` と、`tauri.conf.json` の `version` に一致するファイルだけに署名させる（[.signpath/artifact-configuration.xml](../.signpath/artifact-configuration.xml)）。

## GitHub の設定

| 種類 | 名前 | 中身 |
|---|---|---|
| Secrets | `SIGNPATH_API_TOKEN` | SignPath の API トークン（署名を依頼できる CI 用のユーザー） |
| Variables | `SIGNPATH_ORGANIZATION_ID` | SignPath の組織 ID |
| Variables（任意） | `SIGNPATH_PROJECT_SLUG` | プロジェクトのスラッグ。既定は `agent-guild` |
| Variables（任意） | `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | アーティファクト構成のスラッグ。空なら既定の構成 |
| Variables（任意） | `SIGNPATH_RELEASE_POLICY_SLUG` / `SIGNPATH_TEST_POLICY_SLUG` | 署名ポリシーのスラッグ。既定は `release-signing` / `test-signing` |

```bash
gh secret set SIGNPATH_API_TOKEN
```

```bash
gh variable set SIGNPATH_ORGANIZATION_ID --body "<組織 ID>"
```

## SignPath を使い始めるまで

1. [signpath.org](https://signpath.org/) の申請フォームから、OSS プロジェクトとして申請する。条件は [signpath.org/terms](https://signpath.org/terms)。
2. 承認されると、SignPath の組織・プロジェクト・署名ポリシーが用意される。
3. SignPath の画面で、プロジェクトに Trusted Build System「GitHub.com」をつなぎ、アーティファクト構成に `.signpath/artifact-configuration.xml` の内容を貼る。
4. CI 用のユーザーの API トークンと組織 ID を、上の表のとおり GitHub に登録する。
5. Actions の画面から build を手動実行し、`test-signing` で署名できることを確かめる。

関係者は全員、GitHub と SignPath の両方で多要素認証を使う（SignPath Foundation の条件）。

## 申請フォームの記入例

申請は [signpath.org/apply](https://signpath.org/apply.html) から英語で出す。やり取りはメールなので、返信できるアドレスで申請する。

- **Repository URL**: <https://github.com/tobyapi/agent-guild>
- **License**: MIT（[LICENSE](../LICENSE)）
- **Download / Release URL**: <https://github.com/tobyapi/agent-guild/releases>
- **Code signing policy**: <https://github.com/tobyapi/agent-guild/blob/main/CODE_SIGNING_POLICY.md>
- **Project description**:

  > AI Guild (agent-guild) is a desktop application where people and AI agents (Claude Code, Codex CLI, Ollama and others) talk and work together in Slack-like channels. It is built with Tauri, React and Rust. We distribute a Windows installer (NSIS .exe) and a macOS disk image via GitHub Releases. All binaries are built by GitHub Actions on GitHub-hosted runners from this public repository, and only those builds will be submitted for signing.
