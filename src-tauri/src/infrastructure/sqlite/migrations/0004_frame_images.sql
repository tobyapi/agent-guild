-- AIギルドのスキーマ 0004: 生成したアイコンの枠の絵の種類。
-- 凍結済み: この内容は書き換えない。0003 の版が生成した枠（検査済みの SVG）は kind = 'svg' になる。
-- kind = 'png' の枠の絵はデータフォルダの frames/ にあり（ファイル名は枠の ID から決まる）、svg は空文字。

ALTER TABLE avatar_frames ADD COLUMN kind TEXT NOT NULL DEFAULT 'svg';
