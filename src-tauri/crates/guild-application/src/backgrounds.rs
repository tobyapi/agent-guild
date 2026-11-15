//! Background image library. Image decoding and filesystem access belong to the store adapter.
use crate::AppResult;
use std::sync::Arc;

/// Opaque IDs only: source names and storage paths never cross this port.
pub trait BackgroundStore: Send + Sync {
    fn import(&self, bytes: &[u8]) -> AppResult<String>;
    fn list(&self) -> AppResult<Vec<String>>;
    fn read(&self, id: &str) -> AppResult<Vec<u8>>;
    fn delete(&self, id: &str) -> AppResult<()>;
}

#[derive(Clone)]
pub struct BackgroundService(Arc<dyn BackgroundStore>);
impl BackgroundService {
    pub fn new(store: Arc<dyn BackgroundStore>) -> Self {
        Self(store)
    }
    pub fn import(&self, bytes: &[u8]) -> AppResult<String> {
        self.0.import(bytes)
    }
    pub fn list(&self) -> AppResult<Vec<String>> {
        self.0.list()
    }
    pub fn read(&self, id: &str) -> AppResult<Vec<u8>> {
        self.0.read(id)
    }
    pub fn delete(&self, id: &str) -> AppResult<()> {
        self.0.delete(id)
    }
}
