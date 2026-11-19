-- AI Guild v1. Existing data is classified before this schema is installed.
CREATE TABLE agents (
  id TEXT PRIMARY KEY NOT NULL CHECK (id NOT IN ('me', 'system')),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  avatar TEXT NOT NULL,
  color TEXT NOT NULL,
  role_description TEXT NOT NULL,
  personality TEXT NOT NULL,
  tone TEXT NOT NULL,
  expertise TEXT NOT NULL,
  backend TEXT NOT NULL,
  model TEXT NOT NULL,
  backend_options_json TEXT NOT NULL CHECK (json_valid(backend_options_json) AND json_type(backend_options_json) = 'object'),
  unmentioned TEXT NOT NULL CHECK (unmentioned IN ('lead', 'answer', 'fallback', 'ignore')),
  consultable INTEGER NOT NULL CHECK (consultable IN (0,1)),
  can_delegate INTEGER NOT NULL CHECK (can_delegate IN (0,1)),
  autonomy_enabled INTEGER NOT NULL CHECK (autonomy_enabled IN (0,1)),
  autonomy_interval_min INTEGER NOT NULL CHECK (autonomy_interval_min >= 0),
  autonomy_channel_id TEXT,
  last_autonomous_at INTEGER,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  frame_id TEXT,
  voice_mode TEXT NOT NULL CHECK (voice_mode IN ('off','auto')),
  voice_intensity TEXT NOT NULL CHECK (voice_intensity IN ('weak','medium','strong'))
);
CREATE UNIQUE INDEX agents_active_name ON agents(name_key) WHERE deleted_at IS NULL;

-- The first tag determines role permissions. Other tags retain their display order.
CREATE TABLE agent_tags (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  label TEXT NOT NULL,
  PRIMARY KEY (agent_id,position)
);

CREATE TABLE actors (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('me','system','agent')),
  agent_id TEXT UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  CHECK ((kind = 'agent' AND agent_id IS NOT NULL AND id = agent_id)
      OR (kind IN ('me','system') AND id = kind AND agent_id IS NULL))
);
INSERT INTO actors (id,kind) VALUES ('me','me'), ('system','system');

CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  color TEXT NOT NULL,
  frame_id TEXT
);

CREATE TABLE avatar_frames (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('svg','png')),
  svg_text TEXT,
  created_at INTEGER NOT NULL,
  CHECK ((kind = 'svg') = (svg_text IS NOT NULL))
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('local','linked','builtin')),
  source_path TEXT,
  builtin_name TEXT,
  UNIQUE (agent_id,name),
  CHECK ((source_kind = 'linked') = (source_path IS NOT NULL)),
  CHECK ((source_kind = 'builtin') = (builtin_name IS NOT NULL))
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  topic TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  is_lobby INTEGER NOT NULL CHECK (is_lobby IN (0,1)),
  history_after_seq INTEGER,
  guard_old_roots INTEGER NOT NULL CHECK (guard_old_roots IN (0,1))
);
CREATE UNIQUE INDEX channels_single_lobby ON channels(is_lobby) WHERE is_lobby = 1;

CREATE TABLE channel_members (
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id) CHECK (actor_id <> 'system'),
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (channel_id,actor_id),
  UNIQUE (channel_id,position)
);

CREATE TABLE messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES actors(id),
  content TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('chat','autonomous','progress','system','error')),
  reply_to_id TEXT REFERENCES messages(id) DEFERRABLE INITIALLY DEFERRED,
  root_id TEXT NOT NULL REFERENCES messages(id) DEFERRABLE INITIALLY DEFERRED,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  created_at INTEGER NOT NULL,
  skill_usage_json TEXT CHECK (skill_usage_json IS NULL OR json_valid(skill_usage_json))
);
CREATE INDEX messages_channel_seq ON messages(channel_id,seq);

CREATE TABLE message_attachments (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  attachment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  PRIMARY KEY (message_id,position)
);
CREATE TABLE message_mentions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  actor_id TEXT NOT NULL REFERENCES actors(id) CHECK (actor_id NOT IN ('me','system')),
  PRIMARY KEY (message_id,position)
);

CREATE TABLE delegations (
  id TEXT PRIMARY KEY NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  manager_id TEXT NOT NULL REFERENCES agents(id),
  source_message_id TEXT NOT NULL UNIQUE REFERENCES messages(id),
  status TEXT NOT NULL CHECK (status IN ('running','reporting','done','cancelled')),
  summary_message_id TEXT REFERENCES messages(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX delegations_channel_created ON delegations(channel_id,created_at);

CREATE TABLE subtasks (
  id TEXT PRIMARY KEY NOT NULL,
  delegation_id TEXT NOT NULL REFERENCES delegations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  assignee_id TEXT NOT NULL REFERENCES agents(id),
  instruction TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','failed','cancelled')),
  result_message_id TEXT REFERENCES messages(id),
  note TEXT,
  UNIQUE (delegation_id,position)
);

CREATE TABLE run_measurements (
  job_id TEXT PRIMARY KEY NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  backend TEXT NOT NULL,
  model TEXT,
  duration_ms INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_nano_usd INTEGER
);
CREATE INDEX run_measurements_channel_model ON run_measurements(channel_id,backend,model);
CREATE TABLE skill_record_cutoffs (
  job_id TEXT PRIMARY KEY NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE
);
CREATE TABLE db_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  seeded INTEGER NOT NULL CHECK (seeded IN (0,1))
);
INSERT INTO db_state VALUES (1,0);
CREATE TABLE guild_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  crest_shape TEXT NOT NULL CHECK (crest_shape IN ('diamond','shield','circle','hexagon','star')),
  crest_color TEXT NOT NULL CHECK (crest_color IN ('default','gold','crimson','jade','azure','violet'))
);
CREATE TABLE interrupted_jobs (
  position INTEGER PRIMARY KEY CHECK (position >= 0),
  channel_id TEXT NOT NULL,
  root_id TEXT NOT NULL,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  agent_id TEXT NOT NULL
);
-- A deleted message must never cause a second notification.
CREATE TABLE notification_receipts (
  message_id TEXT PRIMARY KEY NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome = 'attempted')
);
