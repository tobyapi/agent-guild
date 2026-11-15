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

## 共有フィクスチャと確定したエラー対応（工程2a・2b）

### 構文段の確定したエラー対応（工程2a）

Rust の `guild-domain::theme_backdrop::parse_recipe_json` は、Value 化で重複キーが失われる前に次を検証する。返すエラーは `field` と `code` のみで、入力の値・キー名・パーサーの説明文を含めない。

| field | code | 拒否する規則 |
| --- | --- | --- |
| $ | input_too_large | 入力全体が UTF-8 で32 KiB（32768 bytes）を超える |
| $ | invalid_json | 壊れた JSON、後続の余分な文字、説明文・コードフェンス等 |
| $ | nesting_too_deep | 配列・オブジェクトの入れ子が深さ8を超える |
| $ | duplicate_key | 同一オブジェクト内に重複したキーがある（エスケープを復号して比較） |

32 KiB ちょうど、深さ8ちょうどは構文段を通る。深さはルートの配列またはオブジェクトを1と数え、子の配列・オブジェクトごとに1増やす。空の配列・オブジェクトも数え、文字列・数値・真偽値・null は深さを増やさない。重複キーはルートと layers 内を含むすべてのオブジェクトで拒否する。サイズを最初に検査し、その後は読み取り中に最初に検出した拒否理由を返す。

正常6件がこの段を通り、Value 化後も内容が変わらないことを Rust テストで確認する。この段だけでは Recipe の型・Schema・カタログ・数値範囲・コスト・文字保護を検証しない。後続の工程2b・2cおよびTS側の工程3に残す。

### Schema・カタログ段の確定した対応（工程2b）

`theme-backdrop-recipe.json` は既存の behavior 実例と同じ配列形式で、各要素に `name`・`input`・`expected` を持つ。`input` は省略のない Recipe、`expected` は `valid` と `validationErrors:[{field,code}]`。正常例はエラー空配列、異常例は原因となる規則のエラー1件を期待する。値の補正や置換はしない。正常は Schema に通る例であり、描画コスト・文字保護の合格を示さない。

以下の field/code は工程2bの Rust `validate_recipe_structure` と共有実例テストで確定した。TS側の接続は工程3に残す。field はアプリ所有の既知パス（配列は0始まり）、余分なキーは値やキー名を返さず親オブジェクトを指す。Ajv の oneOf 分岐エラー全文や入力由来の説明文は再依頼へ送らない。構造・型・範囲を全レイヤーで先に検査してから、レイヤー順にカタログを検査し、最初のエラー1件を返す。未知の kind は構造段で拒否し、既知 kind の表外 motif と許可外 motion をカタログ段で区別する。

| 異常例 name | field | code | 拒否する規則 |
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

各異常例は正常な tile/turtle を基に1規則だけ変えている。paper-density は kind も paper に合わせ、density 以外は合法にしている。Rust の専用テストで正常6件の受理・入力不変、異常12件の field/code を固定する。この関数は工程2bだけを検査し、安全な描画・保存の許可を意味しない。呼び出し側は工程2aの構文検査を先に通し、工程2cのコスト・文字保護検査を続ける必要がある。

追加の確定コードは、型不一致・整数でない数値が `invalid_type`、数値範囲外が `out_of_range`、必須項目不足が `required`（欠けた既知パス）、title違反が `invalid_title`、palette個数違反が `invalid_palette_length`、dark/light長不一致が `palette_length_mismatch`（`palette`）、colorが実配列長以上なら `color_out_of_bounds`。空のlayersは `too_few_layers`、未対応のcomposition/anchorはそれぞれ `unsupported_composition` / `unsupported_anchor`。fieldは違反した既知項目を指す。整数はJSON Schemaと同じく数値の小数部が0なら受理する。

palette 長一致・実配列に対する color 範囲・title・数値境界・必須/追加項目は工程2bの追加Rustテストで検証する。構文/重複キー・バイト数/深さは工程2aで検証済み。展開予算・文字保護は工程2c、TS検証は工程3に残す。
