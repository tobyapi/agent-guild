//! 共通指示の保存と実行時の読み直し。保存に成功した内容を次の実行から使用する。
use std::sync::Arc;

use guild_domain::prompt::{build_system_prompt_with_global, validate_global_instructions, PromptContext};

use crate::ports::SettingsStore;
use crate::AppResult;

#[derive(Clone)]
pub struct GlobalInstructionsService {
    settings: Arc<dyn SettingsStore>,
}

impl GlobalInstructionsService {
    pub fn new(settings: Arc<dyn SettingsStore>) -> Self {
        Self { settings }
    }

    pub fn get(&self) -> AppResult<String> {
        Ok(self.settings.load()?.global_instructions)
    }

    pub fn set(&self, instructions: String) -> AppResult<()> {
        validate_global_instructions(&instructions)?;
        self.settings.update(Box::new(move |settings| settings.global_instructions = instructions))
    }

    pub fn apply(&self, ctx: &PromptContext<'_>) -> String {
        let instructions = match self.get().and_then(|instructions| {
            validate_global_instructions(&instructions)?;
            Ok(instructions)
        }) {
            Ok(instructions) => instructions,
            Err(error) => {
                log::warn!("共通の指示を適用せずに実行を続けます: {error}");
                String::new()
            }
        };
        build_system_prompt_with_global(ctx, &instructions)
    }
}
