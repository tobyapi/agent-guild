-- AIギルドのスキーマ 0002: チャンネルのアイコン（絵文字1つ。空文字なら画面は # を出す）。
-- 凍結済み: この内容は書き換えない。既存のチャンネルは空（# のまま）になる。

ALTER TABLE channels ADD COLUMN icon TEXT NOT NULL DEFAULT '';
