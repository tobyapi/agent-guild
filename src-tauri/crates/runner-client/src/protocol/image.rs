//! 画像を1枚描く依頼（`agent-runner/src/protocol.ts` の image から type と id を除いたもの。同じ JSON）。

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::SkillPayload;

/// 枠の生成を申告したバックエンド（`BackendInfo::frame_generation`）に、画像を1枚描いてもらう依頼。権限は持たず、
/// アダプタは画像の生成と、添えたスキルの手順に要る道具（作業場所の中だけに書けるコマンド・画像を見る道具）だけを使わせる。
/// 終わったとき、出来上がった PNG は `output` にある
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRequest {
    pub backend: String,
    /// cwd（書き込みはここだけ）
    pub workspace: PathBuf,
    /// アダプタの管理領域
    pub state_dir: PathBuf,
    /// 空なら足さない
    pub system_prompt: String,
    pub prompt: String,
    /// 描くときに従うスキル（run の skills と同じ形。展開はアダプタ）
    pub skills: Vec<SkillPayload>,
    /// 出来上がった PNG の絶対パス（モデルが保存できるよう作業場所の中に置き、プロンプトで伝える。アダプタは始める前に
    /// 前の実行の残りを消し、モデルが保存しなかったときは生成した画像をここに写す）
    pub output: PathBuf,
}
