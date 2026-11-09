-- AIギルドのスキーマ 0001。リリース前はこの1本を直接書き換える（指紋が変わるとデバッグビルドは作り直す）。
-- リリース時に凍結し、以後は 0002 以降を追記する。meta 表は移行の仕組み（migrations.rs）が作る。

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- NFKC＋小文字化した名前（削除されていないエージェントの間で一意）
  name_key TEXT NOT NULL,
  avatar TEXT NOT NULL,
  color TEXT NOT NULL,
  -- JSON 配列（表示と絞り込み用のタグ。振る舞いには使わない）
  tags TEXT NOT NULL,
  role TEXT NOT NULL,
  personality TEXT NOT NULL,
  tone TEXT NOT NULL,
  expertise TEXT NOT NULL,
  backend TEXT NOT NULL,
  model TEXT NOT NULL,
  -- JSON オブジェクト
  backend_options TEXT NOT NULL,
  -- JSON オブジェクト（Permissions。本人に許す操作: webSearch・webFetch・readFiles・writeFiles・writeAnywhere・runCommands・skills）
  permissions TEXT NOT NULL,
  -- メンションのない人間の発言への反応: lead / answer / fallback / ignore
  unmentioned TEXT NOT NULL,
  -- 他のエージェントにメンションされたら参加して答える（0/1）
  consultable INTEGER NOT NULL,
  -- tasks ブロックでタスクを割り振れる（0/1）
  can_delegate INTEGER NOT NULL,
  autonomy_enabled INTEGER NOT NULL,
  autonomy_interval_min INTEGER NOT NULL,
  autonomy_channel_id TEXT,
  last_autonomous_at INTEGER,
  created_at INTEGER NOT NULL,
  -- 論理削除
  deleted_at INTEGER
);
CREATE UNIQUE INDEX agents_active_name ON agents (name_key) WHERE deleted_at IS NULL;

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  -- linked のスキルの参照先（SKILL.md があるフォルダの絶対パス）。アプリ内のスキルは NULL。
  -- linked の name・description・body は追加した時点の写しで、実行のたびに読み直した SKILL.md が正
  source_path TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE (agent_id, name)
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  topic TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 参加順は rowid の順
CREATE TABLE channel_members (
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  -- "me" かエージェント ID
  member_id TEXT NOT NULL,
  PRIMARY KEY (channel_id, member_id)
);

CREATE TABLE messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  -- "me" / "system" / エージェント ID
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  -- JSON 配列（Attachment。人間が貼った画像のメタデータ。中身は attachments/<channel_id>/ のファイル）
  attachments TEXT NOT NULL,
  kind TEXT NOT NULL,
  -- JSON 配列（エージェント ID）
  mentions TEXT NOT NULL,
  reply_to_id TEXT,
  root_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  -- この発言（マネージャーの tasks ブロック）から作られた割り振り
  delegation_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX messages_channel_seq ON messages (channel_id, seq);

-- マネージャーの割り振り（design.md §7.1）
CREATE TABLE delegations (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  manager_id TEXT NOT NULL,
  -- tasks ブロックを含むマネージャーの発言
  message_id TEXT NOT NULL,
  -- running / reporting / done / cancelled
  status TEXT NOT NULL,
  summary_message_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX delegations_channel_created ON delegations (channel_id, created_at);

CREATE TABLE subtasks (
  id TEXT PRIMARY KEY,
  delegation_id TEXT NOT NULL REFERENCES delegations (id) ON DELETE CASCADE,
  -- tasks ブロックに書かれた順
  position INTEGER NOT NULL,
  assignee_id TEXT NOT NULL,
  instruction TEXT NOT NULL,
  -- pending / running / done / failed / cancelled
  status TEXT NOT NULL,
  result_message_id TEXT,
  note TEXT
);
CREATE INDEX subtasks_delegation ON subtasks (delegation_id, position);

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  color TEXT NOT NULL
);
