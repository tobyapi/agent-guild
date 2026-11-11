ALTER TABLE channels ADD COLUMN workspace_json TEXT NOT NULL DEFAULT '{"mode":"legacy","folder":null,"revision":0,"afterSeq":0}';
