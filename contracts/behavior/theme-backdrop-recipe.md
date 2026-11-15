# 背景レシピの契約と版規則

構造契約は [theme-backdrop-recipe.v1.schema.json](theme-backdrop-recipe.v1.schema.json)（JSON Schema Draft 2020-12）。AI が返す Recipe 自体を対象とし、保存時にアプリが付ける `id`・`createdAt`・`recipe` のエンベロープは含まない。

## 版規則

- 現在の reader は `schemaVersion: 1` を読み、writer は v1 を書く。B 等の新しいデータ構造を導入する v2 でだけ `schemaVersion` を上げる。
- v2 writer の導入後も v1 reader を残す。未知の版は拒否し、自動変換・上書きしない。読み込みに失敗しても保存された実体は保持する。
- `catalogVersion: 1` は固定部品と kind × motif・motion の許可集合を識別する。`schemaVersion` と別のフィールドとして検証し、未知のカタログ版も拒否する。
- Recipe の版と外観設定の localStorage v2 キーは別の版である。
- v1 の kind は `tile`・`halftone`・`paper`・`symbol` の4種のみ。B の `pixel` や格子フィールドは受理せず、将来の v2 で追加する。v1 の `tile` の意味は変えない。

## 工程1aの範囲と後続の検証

この工程は構造と版の契約を置く段階であり、アプリの実行時検証にはまだ接続しない。Schema 単体で生成物を安全と判定してはならない。

- 工程1b: motif の列挙、kind × motif・motion の許可分岐、paper 以外の `depth: 1` と未使用 density の正規値を確定する。現在の motif は非空文字列、motion は基本3種の列挙だけであり、組み合わせ検証は未追加。
- 工程1c: 正常・異常の共有フィクスチャを追加する。
- 工程2・3以降: Rust を正として TS と検証を揃える。dark/light の配列長一致、color が両 palette の範囲内であること、有限数、title の UTF-8 上限160 bytes、JSON の重複キー・深さ8・32 KiB 上限、描画コスト、文字保護を検証する。構文 → Schema → カタログ組み合わせ → 展開コスト → 文字保護可能性の順とする。

title の文字数は Unicode コードポイントで1〜40。Schema は制御文字と改行文字を拒否する。余分なプロパティは全オブジェクトで拒否し、不正な値を丸めたり別の絵へ置き換えたりしない。
