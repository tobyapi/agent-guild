# テーマ段階2A 実装・検証記録

2026-11-15。`feat/theme-appearance` の `0b84342` から継続。
画面操作・ブラウザー操作・dev起動・インストール済みアプリの操作・push・mainへのマージは行っていない。

## 実装

- `87d5a4e`: 段階1のユーザーによる開発版確認を記録。
- `ce93d78`: 共有 ThemeBackdrop、3欄の surface、同梱 SVG 2枚、CSS scene、設定と5言語、テストを追加。
- 背景なしでは3欄は元の bg トークンを参照。none/null（guild既定）/素材欠落では背景層を描かず、不透明へ戻る。
- scrim は chat/sidebar/members とも **94%**。背景の明暗による読字への影響を小さくする暫定値で、実測でAAを保証した値ではない。2Bで必要なら各欄のトークンを調整する。
- 背景ありのときだけ hover・選択中の元々透過だった色を不透明に合成し、overlay も不透明にする。入力・コード・dialog・toast・ローカル surface は維持。
- 素材は自作 SVG の dawn/night、CSS の aurora。IDの許可リストで解決し、外部URLやファイルパスは読まない。
- reduced-motion、設定off、document非表示のいずれかでCSSアニメーションを一時停止。解除時も全条件を再確認。毎フレームのstore/React更新なし。

## ファイル

追加（12ファイル）:

- `src/app/AppearanceBackdrop.tsx`
- `src/app/AppShell.appearance.test.tsx`
- `src/features/settings/components/BackgroundPicker.tsx`
- `src/shared/theme/backgrounds.ts`
- `src/shared/ui/theme/ThemeBackdrop.tsx`
- `src/shared/ui/theme/ThemeBackdrop.module.css`
- `src/shared/ui/theme/ThemeBackdrop.test.tsx`
- `src/shared/ui/theme/useBackdropMotion.ts`
- `src/shared/ui/theme/tokens-backdrop.css`
- `src/shared/ui/theme/assets/dawn.svg`
- `src/shared/ui/theme/assets/night.svg`
- `scripts/harness/themeBackdrop.test.mjs`

変更（21ファイル、ce93d78）:

- `src/app/AppShell.tsx`、`AppShell.module.css`、`Sidebar.module.css`
- `src/features/channels/components/MemberPanel.module.css`
- `src/features/settings/appearance.ts`、`appearanceStore.ts`、`model/appearance.ts`、`index.ts`
- `src/features/settings/components/AppearanceSection.tsx`、`AppearanceSection.test.tsx`
- `src/features/settings/i18n/appearance/` の `ja.ts`、`en.ts`、`ko.ts`、`zhHans.ts`、`zhHant.ts`
- `src/shared/theme/types.ts`、`resolve.ts`、`resolve.test.ts`
- `src/shared/ui/theme/tokens.css`
- `docs/architecture.md`、`docs/ui-design.md`

別途、段階1の記録 `docs/theme-stage1-verification.md` と本記録を追加・更新。

## 検証

| 検証 | 結果 |
| --- | --- |
| 限定Vitest: ThemeBackdrop / AppShell.appearance / AppearanceSection / resolve / appearanceStore / appearancePersistence | 6ファイル、73件成功、失敗0 |
| tsc --noEmit -p tsconfig.json | 終了0 |
| 変更TS/TSX/MJSのeslint | 終了0 |
| 変更ファイルのprettier --check | 終了0（文書はリポジトリ設定で対象外、差分を確認） |
| Node: react.test / docsTree / themeBackdrop | 9件成功、失敗0 |
| node scripts/harness/check-ts.mjs | 違反0、終了0 |
| 全体 format:check / typecheck / lint | すべて終了0 |
| 全体 Node ハーネス | 38件成功、失敗0 |
| 全体 Vitest | 174ファイル成功・1スキップ、1261件成功・20スキップ、失敗0 |
| 全体 rust:clippy（-D warnings） | 終了0 |
| 全体 Rustテスト | 431件成功、失敗0（doc-test 0件） |
| npm run check | 全体を通して終了0、制限時間の変更なし |
| npm run build（tsc + Vite） | 終了0、同梱SVGを含むフロントビルド成功 |

CSS契約テストはNodeハーネスで実ファイルを読む。Vitest標準設定がCSSを空へ置き換えるため、CSSの数値やセレクターをそこで検証しない。テストの制限時間・設定は変更していない。

ログは作業フォルダーの `stage2-check.log` と `stage2-build.log`（PowerShell出力、UTF-16）。Node の localStorage 起動警告と、Vite の大きいチャンクの警告が出た。ビルド設定は変更していない。

## 2Bに残す確認

- Windows/WebView2で dark/light × default/sky/silver × dawn/night の12組。通常・hover・選択・未読の名前と印、メンバーの名前と状態、入力とフォーカスを確認。
- 合成後の最も明るい/暗い箇所を採取して通常文字4.5:1、大文字3:1、必要な状態・フォーカス輪郭3:1を確認。sceneも動作中・静止中の明るい領域で確認。
- 長文スクロール、文字選択、チャンネル切替、入力と送信、dialog/toast、未選択初期画面、狭い窓を確認。背景切替で下書き・選択チャンネル・スクロール・フォーカスが保たれ、背景がクリックやTabを奪わないこと。
- reduced-motion/off/非表示を個別・重複して切替。WebView2最小化時のvisibility通知と実際の停止、別の停止条件が残る復帰で再開しないこと。
- 実機再起動後の設定保持、none/null/素材欠落からの復帰を確認。

2Bは未実施。jsdomとCSS契約テストだけでは実機の描画・コントラスト・停止の結果を保証しない。
