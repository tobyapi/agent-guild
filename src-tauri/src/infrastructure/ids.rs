//! ID の発行（IdGenerator の実装。UUID v4）。

use guild_application::ports::IdGenerator;

#[derive(Debug, Default)]
pub struct UuidGenerator;

impl IdGenerator for UuidGenerator {
    fn new_id(&self) -> String {
        uuid::Uuid::new_v4().to_string()
    }
}
