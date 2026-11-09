//! 名前の規則（エージェントと人間のプロフィールで共通）。
//! 照合と重複判定は NFKC＋大文字小文字無視で正規化した名前（name_key）で行う。

use unicode_normalization::UnicodeNormalization;

use super::Agent;
use crate::error::ValidationError;
use crate::ids::AgentId;

/// 名前の最大文字数
pub const NAME_MAX_CHARS: usize = 32;

/// 名前を検証し、前後の空白を除いて返す: 1〜32文字で、空白と @（全角を含む）を含まない
pub fn normalize_name(name: &str) -> Result<String, ValidationError> {
    let name = name.trim();
    let length = name.chars().count();
    if length == 0 {
        return Err(ValidationError::on("name", "名前を入力してください"));
    }
    if length > NAME_MAX_CHARS {
        return Err(ValidationError::on("name", "名前は32文字以内にしてください"));
    }
    let forbidden = |c: char| c.is_whitespace() || c.is_control();
    if name.chars().any(forbidden) || name_key(name).contains('@') {
        return Err(ValidationError::on("name", "名前に空白や @ は使えません"));
    }
    Ok(name.to_owned())
}

/// 照合用の正規化（NFKC＋小文字化）。全角の英数字や「＠」も半角にそろう
pub fn name_key(text: &str) -> String {
    text.nfkc().collect::<String>().to_lowercase()
}

/// 正規化した名前が、削除されていない他のエージェントや人間のプロフィール名と重ならないこと。
/// self_id は更新中のエージェント自身（比べない）、human_name は人間のプロフィール名（比べないなら None）
pub fn ensure_unique_name(
    name: &str,
    agents: &[Agent],
    self_id: Option<&AgentId>,
    human_name: Option<&str>,
) -> Result<(), ValidationError> {
    let key = name_key(name);
    let taken_by_agent = agents
        .iter()
        .filter(|agent| agent.is_active() && Some(&agent.id) != self_id)
        .any(|agent| name_key(&agent.name) == key);
    let taken_by_human = human_name.is_some_and(|human| name_key(human) == key);
    if taken_by_agent || taken_by_human {
        Err(ValidationError::on("name", "その名前はすでに使われています"))
    } else {
        Ok(())
    }
}
