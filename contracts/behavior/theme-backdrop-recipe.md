# 背景レシピの契約と版規則

構造契約は [theme-backdrop-recipe.v1.schema.json](theme-backdrop-recipe.v1.schema.json)（JSON Schema Draft 2020-12）。AI が返す Recipe 自体を対象とし、保存時にアプリが付ける `id`・`createdAt`・`recipe` のエンベロープは含まない。

## 版規則

- 現在の reader は `schemaVersion: 1` を読み、writer は v1 を書く。B 等の新しいデータ構造を導入する v2 でだけ `schemaVersion` を上げる。
- v2 writer の導入後も v1 reader を残す。未知の版は拒否し、自動変換・上書きしない。読み込みに失敗しても保存された実体は保持する。
- `catalogVersion: 1` は固定部品と kind × motif・motion の許可集合を識別する。`schemaVersion` と別のフィールドとして検証し、未知のカタログ版も拒否する。
- Recipe の版と外観設定の localStorage v2 キーは別の版である。
- v1 の kind は `tile`・`halftone`・`paper`・`symbol` の4種のみ。B の `pixel` や格子フィールドは受理せず、将来の v2 で追加する。v1 の `tile` の意味は変えない。

## catalogVersion 1 の許可集合（工程1b完了）

| kind | motif | motion |
| --- | --- | --- |
| tile | star, cross, dot, wave, seaweed, tree, turtle | none のみ |
| halftone | hill, cloud, wave | none のみ |
| paper | hill, cloud, wave, seaweed, tree, turtle, aurora | 全 motif で none。cloud/wave/turtle/aurora のみ drift、tree/seaweed のみ sway |
| symbol | star, cross, dot, wave, seaweed, tree, turtle | 全 motif で none。tree/seaweed のみ sway |

Schema の kind ごとの分岐でこの集合を制限する。paper 以外は `depth: 1` のみ、paper は `depth: 1..3`。density は tile/halftone/symbol で使うため `0..1`、使わない paper は設計 §5 の正規値 `0.5` のみを受け付ける。不正値を正規値へ丸めない。

「海」は wave と seaweed による情景表現であり、`sea` という motif はない。未知の motif（例: `whale`）や表にない組・動きは拒否する。UI で海の対応表を示し、未対応物を別の物へ置き換えず再指定を促すこと、未完成の部品を生成プロンプトへ公開しないことは Schema では保証できないため、後続のカタログ公開・生成 UI 工程で実装する。

## 工程1a〜1cの範囲と後続の検証

工程1a〜1cは構造・版・カタログ許可集合の契約と共有実例を置く段階であり、アプリの実行時検証にはまだ接続しない。Schema 単体で生成物を安全と判定してはならない。

- 工程1b完了: 上表の kind × motif・motion、paper 以外の `depth: 1`、paper の `density: 0.5` を Schema で制限した。
- 工程1c完了: [theme-backdrop-recipe.json](theme-backdrop-recipe.json) に正常6件・異常12件の共有フィクスチャを追加した。工程2・3で Rust/TS の検証へ接続する。
- 工程2・3以降: Rust を正として TS と検証を揃える。dark/light の配列長一致、color が両 palette の範囲内であること、有限数、title の UTF-8 上限160 bytes、JSON の重複キー・深さ8・32 KiB 上限、描画コスト、文字保護を検証する。構文 → Schema → カタログ組み合わせ → 展開コスト → 文字保護可能性の順とする。

title の文字数は Unicode コードポイントで1〜40。Schema は制御文字と改行文字を拒否する。余分なプロパティは全オブジェクトで拒否し、不正な値を丸めたり別の絵へ置き換えたりしない。

## 共有フィクスチャと仮のエラー対応（工程1c）

`theme-backdrop-recipe.json` は既存の behavior 実例と同じ配列形式で、各要素に `name`・`input`・`expected` を持つ。`input` は省略のない Recipe、`expected` は `valid` と `validationErrors:[{field,code}]`。正常例はエラー空配列、異常例は原因となる規則のエラー1件を期待する。値の補正や置換はしない。正常は Schema に通る例であり、描画コスト・文字保護の合格を示さない。

以下の field/code は設計 §5.2 に沿った**仮の対応**で、工程2・3で Rust を正として確定し、両言語と本フィクスチャを揃える。field はアプリ所有の既知パス（配列は0始まり）、余分なキーは値やキー名を返さず親オブジェクトを指す。Ajv の oneOf 分岐エラー全文や入力由来の説明文は再依頼へ送らない。kind が未知なら kind を先に報告し、既知 kind の表外 motif と許可外 motion を区別する。

| 異常例 name | field | code（仮） | 拒否する規則 |
| --- | --- | --- | --- |
| invalid-kind-motif | layers[0].motif | unsupported_motif | halftone × turtle は表外 |
| unknown-whale | layers[0].motif | unsupported_motif | whale は未対応、置換禁止 |
| forbidden-motion | layers[0].motion | unsupported_motion | tile の drift は禁止 |
| unknown-schema-version | schemaVersion | unsupported_version | v1 reader は2を拒否 |
| unknown-catalog-version | catalogVersion | unsupported_catalog | catalogVersion は1のみ |
| future-pixel-kind | layers[0].kind | unsupported_kind | pixel は v1 に含めない |
| extra-root-field | $ | additional_property | ルートの余分なキーを拒否 |
| extra-layer-field | layers[0] | additional_property | レイヤーの格子キーを拒否 |
| non-paper-depth | layers[0].depth | invalid_depth | paper 以外の depth は1 |
| paper-density | layers[0].density | invalid_density | paper の density は0.5 |
| nine-layers | layers | too_many_layers | layers は最大8個 |
| invalid-palette-color | palette.dark[1] | invalid_color | 色は #RRGGBB 形式 |

各異常例は正常な tile/turtle を基に1規則だけ変えている。paper-density は kind も paper に合わせ、density 以外は合法にしている。Schema 照合では受理/拒否を確かめ、field/code の返却は未実装なので検証した扱いにしない。既存テストは変更せず、工程2・3で専用の共有実例テストを追加する。

Schema だけでは判定できない palette 長の一致・実配列に対する color 範囲・構文/重複キー・バイト数/深さ・展開予算・文字保護の実例は今回追加せず、工程2・3以降に残す。
