ALTER TABLE channels ADD COLUMN is_lobby INTEGER NOT NULL DEFAULT 0 CHECK (is_lobby IN (0, 1));

-- 一度だけ、最古の旧ロビーを引き継ぐ。メンバーとエージェントは変更しない。
UPDATE channels SET is_lobby = 1
WHERE id = (SELECT id FROM channels WHERE name = 'ロビー' ORDER BY created_at, rowid LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM channels WHERE is_lobby = 1);
