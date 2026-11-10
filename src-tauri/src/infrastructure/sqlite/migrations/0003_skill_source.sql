-- スキルの出どころを SkillSource の JSON で持つ（{"kind":"linked","path":…} / {"kind":"builtin","name":…}）。
-- アプリ内のスキルは NULL。linked・builtin の name・description・body は追加した時点の写しで、
-- 実行のたびに読み直した参照先（ライブラリの SKILL.md・同梱の内蔵スキル）が正。
ALTER TABLE skills ADD COLUMN source TEXT;
UPDATE skills SET source = json_object('kind', 'linked', 'path', source_path) WHERE source_path IS NOT NULL;
ALTER TABLE skills DROP COLUMN source_path;
