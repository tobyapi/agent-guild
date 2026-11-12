//! AIギルドのドメイン: 純粋なモデルとルール（I/O なし。依存は serde・serde_json・unicode-normalization だけ）。
//! JSON の形は TS の型 `src/shared/types/domain/`（React ⇄ Rust の契約）と一致させ、`contracts/ipc/` の実例で検査する。

pub mod activity;
pub mod agent;
pub mod attachment;
pub mod author;
pub mod autonomy;
pub mod backend;
pub mod boot;
pub mod channel;
pub mod conversation;
pub mod delegation;
pub mod error;
pub mod frame;
pub mod guild;
pub mod ids;
pub mod link;
pub mod locale;
pub mod message;
pub mod profile;
pub mod prompt;
pub mod skill;
pub mod snapshot;
pub mod statistics;
pub mod storage;
pub mod update;
