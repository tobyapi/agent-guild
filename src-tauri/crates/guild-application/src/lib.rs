//! AIギルドのユースケース。外界とはポート（ports）越しにだけ話し、guild-domain だけに依存する。

pub mod agents;
pub mod autonomy;
pub mod backends;
pub mod channels;
pub mod conversation;
pub mod error;
pub mod frames;
pub mod guild;
pub mod language;
pub mod maintenance;
pub mod ports;
pub mod profile;
pub mod services;
pub mod skills;
pub mod snapshot;
pub mod storage;

pub use error::{AppError, AppResult};
pub use services::{AppServices, Ports, StoragePorts};
