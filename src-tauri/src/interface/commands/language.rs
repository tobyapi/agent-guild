//! 表示とエージェントの会話の言語（復旧モードでも動く。docs/i18n.md）。

use guild_application::language::LanguageService;
use guild_domain::locale::Language;
use tauri::State;

use super::{reject, CommandResult};

/// settings.json に保存し、いまの言語にしてランナーにも伝える
#[tauri::command]
pub async fn set_language(language: Language, service: State<'_, LanguageService>) -> CommandResult<()> {
    service.set(language).await.map_err(reject)
}
