//! Access to local files named in messages, supplied by the filesystem adapter.

use crate::AppResult;
use guild_domain::ids::AgentId;
pub use guild_domain::local_image::LocalImage;
use std::sync::Arc;

pub trait LocalFileAccess: Send + Sync {
    fn reveal(&self, path: &str, agent_id: Option<&AgentId>) -> AppResult<()>;
    fn read_image(&self, path: &str, agent_id: Option<&AgentId>) -> LocalImage;
}

pub struct LocalFileService(Arc<dyn LocalFileAccess>);

impl LocalFileService {
    pub fn new(access: Arc<dyn LocalFileAccess>) -> Self {
        Self(access)
    }
    pub fn reveal(&self, path: &str, agent_id: Option<&AgentId>) -> AppResult<()> {
        self.0.reveal(path, agent_id)
    }
    pub fn read_image(&self, path: &str, agent_id: Option<&AgentId>) -> LocalImage {
        self.0.read_image(path, agent_id)
    }
}
