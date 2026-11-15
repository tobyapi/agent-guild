# テーマ設定の段階1：検証記録

2026-11-15、`feat/theme-appearance` の `eecc536` を対象に確認した。
画面比較が未実施のため、段階1全体はまだ完了として扱わない。

## 画面比較と実機確認

比較元は main `8c68dc91`、または `2265593` の比較用 worktree。
`2265593` は新モジュール追加だけで、起動処理・外観コンポーネント・テーマCSSは
`8c68dc91` と同一であることを `git diff --quiet`（終了0）で確認した。

変更前と変更後を同じ表示サイズ・同じ内容・背景なしで開き、設定画面と会話画面を
切り替えて比べる予定だった。ブラウザー接続は利用できず、Windows画面操作へ進んだが、
Chromeで新規タブを開いた時点でユーザー入力との競合を検知した。
ゲームが前面にあることも確認できたため、以後の入力を止めた。
dev画面には到達していない。既存のインストール済みアプリは停止していない。

| アクセント | dark | light |
| --- | --- | --- |
| default | 未確認 | 未確認 |
| vermilion | 未確認 | 未確認 |
| sakura | 未確認 | 未確認 |
| green | 未確認 | 未確認 |
| sky | 未確認 | 未確認 |
| violet | 未確認 | 未確認 |
| silver | 未確認 | 未確認 |

- OS明暗の追従：実機画面では未確認。ユーザーの操作と競合するためOS設定を操作していない。
- 保存後の再起動：実機画面では未確認。dev版の画面確認に到達していない。
- 保存なしの既定dark：実機画面では未確認。
- 既存のjsdomテストではOS変更イベントとdispose→initでの復元を検証済みだが、実機確認とは区別する。

補助確認として、`git diff --quiet 8c68dc91 eecc536 -- ':(glob)**/*.css'` は終了0。
`src` のCSS検索では `data-theme-id` の参照はなく、従来どおり `data-theme` と
`data-accent` で色を選ぶ。これは画面の一致を判定した結果ではない。

## 全体チェック

1回目の `npm run check` は整形・型・lint・ハーネスまで通過。
Vitestは171ファイル成功・1ファイル失敗・1ファイルスキップ、
1254件成功・1件失敗・20件スキップ。
失敗は `App.agents.test.tsx` の「名前が空か、ほかのエージェントと同じなら、作成せずに名前の欄で知らせる」が
5000msでタイムアウトしたもの。前回のbeforeAll 10000msタイムアウトとは別である。
比較用Viteサーバー2本の起動と時間帯が重なったが、因果関係は未確定。

サーバー停止後、`npx vitest run src/app/App.agents.test.tsx` は6件成功・失敗0。
タイムアウト値・テスト設定・アプリのコードは変更していない。
全体チェックの2回目ではVitestが172ファイル成功・1ファイルスキップ、
1255件成功・失敗0・20件スキップ。clippyも警告をエラーとする設定で通過した。
Rustテストの結果は完了後に追記する。

## 作業環境の復旧と片付け

比較用worktreeの `node_modules` は本体へのjunctionだった。
PowerShellの `Remove-Item` でjunction削除がエラーになった後、続く
`git worktree remove` が共有先の依存ファイルも一部削除した。
処理を停止してjunction自体を外し、lockfileを使った `npm ci` で復元している。
ソースやlockfileの変更はない。復元後の検証結果は追記する。

worktreeのGit登録は `git worktree prune` で解除済み。
残存フォルダーは
`D:/agent-guild-data/agents/717d11c3-6573-4b32-b960-58ed06e589d6/work/stage1a-baseline`。
このフォルダーの再帰削除は自動承認レビューに `blocked by policy` として拒否されたため、
別の方法で再試行せず残している。元の比較用worktreeとしては使えないため、再比較時は作り直す。

## 再開手順

画面操作が競合しない時間に、14組とsystemのOS追従、設定保存後の再起動を確認する。
同じ表示サイズとモックの同じ画面内容で比較し、DOM属性・設定UI・操作結果も照合する。
WebView2で未確認の項目は、Chromeで確認できた項目と分けて記録する。
背景の実装には進まない。

## 依存復旧と全体チェック（2026-11-15 13:01〜13:10）

- feat/theme-appearance の e7a8e82 から継続。開始時に前回の npm ci・check・cargo・rustc プロセスが残っていないことを確認。既存アプリや他のプロセスは停止していない。
- D:/agent-guild で `npm ci --offline --no-audit --no-fund` が終了0。459パッケージを約5分で復元。オンラインへの切替は不要だった。
- `node_modules/.package-lock.json` は存在し、`npm ls --depth=0` は終了0、依存エラー0。
- 復元後の git status は、以前からある未追跡 `start-guild.cmd - ショートカット.lnk` のみ。ソース・package-lock.json の変更なし。
- 画面操作・devサーバー起動・インストール済みアプリの停止・push は行っていない。
- `git worktree list` に stage1a-baseline はない。登録一覧は本体と別作業の character-voice の2件。残存フォルダーは依頼どおり削除していない。

| 検証 | 結果 |
| --- | --- |
| npm run format:check | 終了0。Prettier・cargo fmt とも成功 |
| npm run typecheck | 終了0。アプリ・agent-runner とも成功 |
| npm run lint | 終了0 |
| npm run harness | 36件成功、失敗0。TS境界チェックも成功 |
| npm run test | 172ファイル成功・1スキップ。1255件成功・20スキップ・失敗0 |
| npm run rust:clippy | 終了0（-D warnings） |
| npm run rust:test | 終了0。431件成功、失敗0。doc-testは0件 |
| npm run check | 上記を通しで1回実行、終了0。タイムアウト0回、部分再実行なし |

Rustテストは復元中に単独でも実行し、431件成功・失敗0。その後の全体チェック内でも成功した。
Node の `--localstorage-file` 警告と、Rust test のMSVCリンカーのライブラリ作成出力に由来する警告1件が出たが、各コマンドは終了0。clippyは警告をエラー扱いにする設定で成功した。
テスト設定・タイムアウト値・ソース・lockfileは変更していない。

ログは作業フォルダー `D:/agent-guild-data/agents/717d11c3-6573-4b32-b960-58ed06e589d6/work/` の
`stage1c-restore.log`、`stage1c-npm-ls.log`、`stage1c-rust-test.log`、`stage1c-check.log`。

依存の復旧と今回のチェックは完了。段階1全体は、14組の画面比較・OS追従・実機再起動での保持が未確認のため、まだ完了扱いにしない。
次の一手は画面確認の実施方法と時間帯を決め、未確認項目を確認すること。背景の実装には進まない。
