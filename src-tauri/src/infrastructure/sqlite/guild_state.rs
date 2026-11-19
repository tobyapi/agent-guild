use super::{
    codec::{json_column, storage, to_json},
    Database,
};
use guild_application::ports::{GuildStateRepository, InterruptedJob};
use guild_application::AppResult;
use guild_domain::guild::GuildProfile;
use guild_domain::ids::{AgentId, ChannelId, MessageId};
use rusqlite::{params, OptionalExtension};
use std::sync::Arc;

pub struct SqliteGuildStateRepository {
    db: Arc<Database>,
}

impl SqliteGuildStateRepository {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

impl SqliteGuildStateRepository {
    pub fn seed(
        &self,
        agent: &guild_domain::agent::Agent,
        channel: &guild_domain::channel::Channel,
        welcome: &guild_domain::message::NewMessage,
    ) -> AppResult<()> {
        self.db
            .with(|c| {
                let tx = c.unchecked_transaction()?;
                if tx.execute("UPDATE db_state SET seeded=1 WHERE id=1 AND seeded=0", [])? == 1 {
                    super::agents::insert_agent(&tx, agent)?;
                    super::channels::insert_channel(&tx, channel)?;
                    super::messages::store_message(&tx, welcome)?;
                }
                tx.commit()
            })
            .map_err(storage)
    }
}

impl GuildStateRepository for SqliteGuildStateRepository {
    fn seeded(&self) -> AppResult<bool> {
        self.db.with(|c| c.query_row("SELECT seeded FROM db_state WHERE id=1", [], |r| r.get(0))).map_err(storage)
    }
    fn guild(&self) -> AppResult<GuildProfile> {
        self.db
            .with(|c| {
                c.query_row(
                    "SELECT json_object('name',name,'crest',json_object('shape',crest_shape,'color',crest_color))
            FROM guild_profile WHERE id=1",
                    [],
                    |r| json_column(r, 0),
                )
                .optional()
            })
            .map(|v| v.unwrap_or_default())
            .map_err(storage)
    }
    fn save_guild(&self, guild: &GuildProfile) -> AppResult<()> {
        self.db
            .with(|c| {
                c.execute(
                    "INSERT INTO guild_profile (id,name,crest_shape,crest_color)
            VALUES (1,?1,json_extract(?2,'$.shape'),json_extract(?2,'$.color')) ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,crest_shape=excluded.crest_shape,crest_color=excluded.crest_color",
                    params![guild.name, to_json(&guild.crest)?],
                )
            })
            .map(|_| ())
            .map_err(storage)
    }
    fn interrupted_jobs(&self) -> AppResult<Vec<InterruptedJob>> {
        self.db
            .with(|c| {
                c.prepare("SELECT channel_id,root_id,depth,agent_id FROM interrupted_jobs ORDER BY position")?
                    .query_map([], |r| {
                        Ok(InterruptedJob {
                            channel_id: ChannelId::new(r.get::<_, String>(0)?),
                            root_id: MessageId::new(r.get::<_, String>(1)?),
                            depth: r.get(2)?,
                            agent_id: AgentId::new(r.get::<_, String>(3)?),
                        })
                    })?
                    .collect()
            })
            .map_err(storage)
    }
    fn replace_interrupted(&self, jobs: &[InterruptedJob]) -> AppResult<()> {
        self.db.with(|c|{
            let tx=c.unchecked_transaction()?;
            tx.execute("DELETE FROM interrupted_jobs",[])?;
            for (position, j) in (0_i64..).zip(jobs.iter()) {
                tx.execute("INSERT INTO interrupted_jobs (position,channel_id,root_id,depth,agent_id) VALUES (?1,?2,?3,?4,?5)",
                    params![position,j.channel_id.as_str(),j.root_id.as_str(),j.depth,j.agent_id.as_str()])?;
            }
            tx.commit()
        }).map_err(storage)
    }
    fn claim_notification(&self, message: &str) -> AppResult<bool> {
        self.db
            .with(|c| {
                c.execute(
                    "INSERT INTO notification_receipts (message_id,outcome) VALUES (?1,'attempted')
            ON CONFLICT(message_id) DO NOTHING",
                    [message],
                )
            })
            .map(|n| n == 1)
            .map_err(storage)
    }
}
