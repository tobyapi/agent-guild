//! 共通指示の保存と実行時の読み直し。保存に成功した内容を次の実行から使用する。
use std::sync::Arc;

use guild_domain::prompt::{validate_global_instructions, with_global_instructions};

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
        let text = self.settings.load()?.global_instructions;
        validate_global_instructions(&text)?;
        Ok(text)
    }

    pub fn set(&self, instructions: String) -> AppResult<()> {
        validate_global_instructions(&instructions)?;
        let mut settings = self.settings.load()?;
        settings.global_instructions = instructions;
        self.settings.save(&settings)
    }

    pub fn apply(&self, prompt: String) -> AppResult<String> {
        Ok(with_global_instructions(prompt, &self.get()?))
    }
}
