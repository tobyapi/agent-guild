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

## 背景が見えない問題の修正（2026-11-15）

`3b3df0b` から継続。原因は94%のscrimと淡いdawnの組み合わせで、背景の色差が合成後にほぼ消えたこと。
背景層の構造・設定の保存方法は変更せず、3欄ともダーク89%・ライト90%にした。
上記の94%は初期実装時の履歴であり、現在の設定ではない。

70〜80%も試算したが、ダーク75%・ライト80%では本文は基準を満たす一方、`--text-muted` が最悪2.93:1/3.47:1に下がる。
時刻などの補助文字も維持するため89%/90%を選び、SVG側の明暗差を広げて形の見え方と両立させた。
dawnは金色の空・明るい太陽・青緑の丘、nightは青い空・明るい月・段階の異なる青い丘とした。
単色の不透明な自作SVGのみで、外部参照・フィルター・透明な塗りは使用しない。
auroraは緑 `#30dcb5c0` と紫 `#a18affb0` に変更し、下地のnightと合わせて彩度と色差を増やした。

### 計算と回帰テスト

`scripts/harness/themeBackdropContrast.test.mjs` は実際のCSSトークン・SVGの色を読み、3欄ごとにsRGBで
`合成色 = 地色 × scrim + SVG色 × (1 − scrim)` を求め、sRGBを線形化して相対輝度Lを計算する。
丸め前の値で、形の相対輝度比 `Lmax/Lmin >= 1.15`、さらに黒に近い領域で厳しい
`(Lmax+0.05)/(Lmin+0.05) >= 1.15` の両方を検査する。
文字は本文 `--text-primary` と補助文字 `--text-muted` について、明暗両端とのWCAGコントラスト4.5:1以上を検査する。

| テーマ・素材 | 形 Lmax/Lmin（3欄の最小） | 形 +0.05補正比（3欄の最小） | 本文の最悪コントラスト | 補助文字の最悪コントラスト |
| --- | --- | --- | --- | --- |
| ライト・dawn | 1.174707 | 1.164610 | 12.093270:1 | 4.567921:1 |
| ライト・night | 1.167131 | 1.157557 | 12.204915:1 | 4.610093:1 |
| ダーク・dawn | 2.226770 | 1.255224 | 10.055014:1 | 4.680450:1 |
| ダーク・night | 2.156930 | 1.250074 | 10.000637:1 | 4.655138:1 |

SVGは全色が各RGBチャンネルの最小色・最大色の間に入り、それぞれの端点色が実際に塗られていることを検査する。
空・太陽/月・2枚の丘の幾何形状も固定して、端点色がviewBox内に現れる根拠を維持する。
未対応の要素・属性（gradient、opacity、外部参照など）は黙って無視せず失敗させる。
境界のアンチエイリアスはこの色範囲内に収まる。scrimが94%に戻ると形の検査が失敗する。
auroraを含む本文コントラストは、さらに背景が完全な黒〜白の任意の色でも4.5:1以上を満たす保守的な上下限で検査する。
auroraの動く形の見え方、補助文字、実際のWebView2描画はこの追加の上下限保証の対象外。

これはSVG全体の色範囲に対する数値検査。窓の縦横比によるcoverの切り抜き、各欄内の局所的な見え方、
状態色・フォーカス・動作中のsceneを含む2Bの実機確認を置き換えるものではない。

### 検証・確認方法

- 変更したMJSのeslint、CSS/MJSのprettier --check、SVGは `prettier --parser html --check` を使用。
  Prettierは拡張子svgからパーサーを推定できないため、SVGのみ明示した。
- `npx tsc --noEmit -p tsconfig.json`: 成功。
- `npm run harness`: 42件成功、TS保守性の違反0。scrimだけ94%に置き換えてメモリ上で実行した場合、4組すべてが形の補正比の検査で失敗することも確認した（実ファイルの値は変更しない）。
- ThemeBackdrop・AppearanceSection限定Vitest: 2ファイル8件成功。
- `npm run check`: 終了0。全体format/typecheck/lint、ハーネス42件、Vitest1261件成功・20件skip、clippy、Rust431件成功。
  ログは作業フォルダーの `stage2-backdrop-check.log`（UTF-16）。既存のNode localStorage起動警告とWindowsリンカーのライブラリー作成通知が出た。
- テストの制限時間・設定の変更なし。画面操作、dev起動、push、mainへのマージなし。

ユーザー確認は開発版を起動し直して、設定 → 外観で次の2通りを選ぶ。

1. ライト＋朝の丘：空と青緑の丘が区別でき、本文と時刻が読めること。
2. ダーク＋夜の背景：月と青い丘が区別でき、本文と時刻が読めること。

実機での見え方は未確認。以前Consoleでscrimを上書きした場合も、再起動後の値で確認する。
