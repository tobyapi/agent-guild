//! ポートの実装（アダプタ）。組み立ては bootstrap が行う。

pub mod app_control;
pub mod attachments;
pub mod clock;
pub mod data_dir;
pub mod events;
pub mod export;
pub mod file_manager;
pub mod folders;
pub mod ids;
pub mod logging;
pub mod runtime;
pub mod settings;
pub mod skill_library;
pub mod spawner;
pub mod sqlite;
pub mod workspace;

#[cfg(test)]
mod tests;
