import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Agent, Channel, Message, Profile, Skill } from '../shared/types.js';
import { HUMAN_ID } from '../shared/types.js';

export const DATA_DIR = path.resolve(process.env.GUILD_DATA_DIR ?? 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'guild.db'));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#5865f2',
  role TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  expertise TEXT NOT NULL DEFAULT '',
  backend TEXT NOT NULL DEFAULT 'claude',
  model TEXT NOT NULL DEFAULT '',
  autonomy_enabled INTEGER NOT NULL DEFAULT 0,
  autonomy_interval_min INTEGER NOT NULL DEFAULT 60,
  autonomy_channel_id TEXT,
  last_autonomous_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  PRIMARY KEY (channel_id, member_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat',
  mentions TEXT NOT NULL DEFAULT '[]',
  reply_to_id TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

type Row = Record<string, any>;

const toAgent = (r: Row): Agent => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  avatar: r.avatar,
  color: r.color,
  role: r.role,
  personality: r.personality,
  tone: r.tone,
  expertise: r.expertise,
  backend: r.backend,
  model: r.model,
  autonomyEnabled: !!r.autonomy_enabled,
  autonomyIntervalMin: r.autonomy_interval_min,
  autonomyChannelId: r.autonomy_channel_id ?? null,
  lastAutonomousAt: r.last_autonomous_at ?? null,
  createdAt: r.created_at,
});

const toMessage = (r: Row): Message => ({
  id: r.id,
  channelId: r.channel_id,
  authorId: r.author_id,
  content: r.content,
  kind: r.kind,
  mentions: JSON.parse(r.mentions),
  replyToId: r.reply_to_id ?? null,
  depth: r.depth,
  createdAt: r.created_at,
});

const toSkill = (r: Row): Skill => ({
  id: r.id,
  agentId: r.agent_id,
  name: r.name,
  description: r.description,
  body: r.body,
  updatedAt: r.updated_at,
});

// ---------- agents ----------

export const listAgents = (): Agent[] =>
  (db.prepare('SELECT * FROM agents ORDER BY created_at').all() as Row[]).map(toAgent);

export const getAgent = (id: string): Agent | undefined => {
  const r = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Row | undefined;
  return r ? toAgent(r) : undefined;
};

export type AgentInput = Omit<Agent, 'id' | 'createdAt' | 'lastAutonomousAt'>;

export function createAgent(input: AgentInput): Agent {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO agents (id, kind, name, avatar, color, role, personality, tone, expertise, backend, model,
      autonomy_enabled, autonomy_interval_min, autonomy_channel_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.kind,
    input.name,
    input.avatar,
    input.color,
    input.role,
    input.personality,
    input.tone,
    input.expertise,
    input.backend,
    input.model,
    input.autonomyEnabled ? 1 : 0,
    input.autonomyIntervalMin,
    input.autonomyChannelId,
    Date.now(),
  );
  return getAgent(id)!;
}

export function updateAgent(id: string, input: Partial<AgentInput>): Agent | undefined {
  const cur = getAgent(id);
  if (!cur) return undefined;
  const a = { ...cur, ...input };
  db.prepare(
    `UPDATE agents SET kind=?, name=?, avatar=?, color=?, role=?, personality=?, tone=?, expertise=?, backend=?, model=?,
      autonomy_enabled=?, autonomy_interval_min=?, autonomy_channel_id=? WHERE id=?`,
  ).run(
    a.kind,
    a.name,
    a.avatar,
    a.color,
    a.role,
    a.personality,
    a.tone,
    a.expertise,
    a.backend,
    a.model,
    a.autonomyEnabled ? 1 : 0,
    a.autonomyIntervalMin,
    a.autonomyChannelId,
    id,
  );
  return getAgent(id);
}

export const markAutonomous = (id: string) =>
  db.prepare('UPDATE agents SET last_autonomous_at = ? WHERE id = ?').run(Date.now(), id);

export function deleteAgent(id: string) {
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  db.prepare('DELETE FROM skills WHERE agent_id = ?').run(id);
  db.prepare('DELETE FROM channel_members WHERE member_id = ?').run(id);
}

// ---------- skills ----------

export const listSkills = (agentId: string): Skill[] =>
  (db.prepare('SELECT * FROM skills WHERE agent_id = ? ORDER BY name').all(agentId) as Row[]).map(toSkill);

export const getSkill = (id: string): Skill | undefined => {
  const r = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Row | undefined;
  return r ? toSkill(r) : undefined;
};

export function upsertSkill(s: { id?: string; agentId: string; name: string; description: string; body: string }): Skill {
  const id = s.id ?? randomUUID();
  db.prepare(
    `INSERT INTO skills (id, agent_id, name, description, body, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, body=excluded.body, updated_at=excluded.updated_at`,
  ).run(id, s.agentId, s.name, s.description, s.body, Date.now());
  return getSkill(id)!;
}

export const deleteSkill = (id: string) => db.prepare('DELETE FROM skills WHERE id = ?').run(id);

// ---------- channels ----------

export function listChannels(): Channel[] {
  const chans = db.prepare('SELECT * FROM channels ORDER BY created_at').all() as Row[];
  const members = db.prepare('SELECT * FROM channel_members').all() as Row[];
  return chans.map((c) => ({
    id: c.id,
    name: c.name,
    topic: c.topic,
    createdAt: c.created_at,
    memberIds: members.filter((m) => m.channel_id === c.id).map((m) => m.member_id),
  }));
}

export const getChannel = (id: string): Channel | undefined => listChannels().find((c) => c.id === id);

export function createChannel(name: string, topic: string, memberIds: string[]): Channel {
  const id = randomUUID();
  db.prepare('INSERT INTO channels (id, name, topic, created_at) VALUES (?, ?, ?, ?)').run(id, name, topic, Date.now());
  for (const m of new Set([HUMAN_ID, ...memberIds])) addMember(id, m);
  return getChannel(id)!;
}

export function updateChannel(id: string, name: string, topic: string) {
  db.prepare('UPDATE channels SET name = ?, topic = ? WHERE id = ?').run(name, topic, id);
}

export function deleteChannel(id: string) {
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  db.prepare('DELETE FROM channel_members WHERE channel_id = ?').run(id);
  db.prepare('DELETE FROM messages WHERE channel_id = ?').run(id);
}

export const addMember = (channelId: string, memberId: string) =>
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, member_id) VALUES (?, ?)').run(channelId, memberId);

export const removeMember = (channelId: string, memberId: string) =>
  db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND member_id = ?').run(channelId, memberId);

// ---------- messages ----------

export function insertMessage(m: Omit<Message, 'id' | 'createdAt'>): Message {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO messages (id, channel_id, author_id, content, kind, mentions, reply_to_id, depth, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, m.channelId, m.authorId, m.content, m.kind, JSON.stringify(m.mentions), m.replyToId, m.depth, Date.now());
  return getMessage(id)!;
}

export const getMessage = (id: string): Message | undefined => {
  const r = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Row | undefined;
  return r ? toMessage(r) : undefined;
};

/** 新しい順に limit 件取って、古い順に並べて返す */
export function recentMessages(channelId: string, limit = 50, before?: number): Message[] {
  const rows = (
    before
      ? db
          .prepare('SELECT * FROM messages WHERE channel_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?')
          .all(channelId, before, limit)
      : db.prepare('SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?').all(channelId, limit)
  ) as Row[];
  return rows.map(toMessage).reverse();
}

// ---------- settings ----------

const DEFAULT_PROFILE: Profile = { name: 'あなた', avatar: '🙂', color: '#3ba55d' };

export function getProfile(): Profile {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'profile'").get() as Row | undefined;
  return r ? { ...DEFAULT_PROFILE, ...JSON.parse(r.value) } : DEFAULT_PROFILE;
}

export const setProfile = (p: Profile) =>
  db
    .prepare("INSERT INTO settings (key, value) VALUES ('profile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(p));

export const isEmpty = () => (db.prepare('SELECT COUNT(*) AS n FROM agents').get() as Row).n === 0;
