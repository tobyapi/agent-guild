-- AIギルドのスキーマ 0003: アイコンの枠。
-- 凍結済み: この内容は書き換えない。既存のエージェントとプロフィールは枠なし（空文字）になる。
-- frame は内蔵の枠（builtin:<名前>）か生成した枠（custom:<ID>）の ID。avatar_frames は生成した枠（検査済みの SVG）。

ALTER TABLE agents ADD COLUMN frame TEXT NOT NULL DEFAULT '';
ALTER TABLE profile ADD COLUMN frame TEXT NOT NULL DEFAULT '';

CREATE TABLE avatar_frames (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  svg TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
