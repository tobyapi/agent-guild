//! 表示とエージェントの会話の言語の変更（docs/i18n.md）。settings.json に保存し、プロセスのいまの言語にして、
//! ランナーにも伝える。復旧モードでも動く（そのときはランナーがないので、保存といまの言語だけ）。

use std::sync::Arc;

use guild_domain::locale::{self, Language};

use crate::error::AppResult;
use crate::ports::{AgentRuntime, SettingsStore};

#[derive(Clone)]
pub struct LanguageService {
    settings: Arc<dyn SettingsStore>,
    /// 復旧モードでは None
    runtime: Option<Arc<dyn AgentRuntime>>,
    /// いまの言語を変える（本番は locale::set_current。テストはプロセス全体の状態を変えないものに差し替える）
    apply: fn(Language),
}

impl LanguageService {
    pub fn new(settings: Arc<dyn SettingsStore>, runtime: Option<Arc<dyn AgentRuntime>>) -> Self {
        Self { settings, runtime, apply: locale::set_current }
    }

    /// いまの言語の変え方を差し替える（テスト用。並行するテストのためにプロセスの状態を変えない）
    pub fn with_apply(self, apply: fn(Language)) -> Self {
        Self { apply, ..self }
    }

    /// settings.json に保存してある言語（まだ選んでいなければ None）
    pub fn saved(&self) -> AppResult<Option<Language>> {
        Ok(self.settings.load()?.language)
    }

    /// 保存してから、いまの言語にしてランナーへ伝える。settings.json が新しい版のものなら書き換えずに Storage
    pub async fn set(&self, language: Language) -> AppResult<()> {
        let mut settings = self.settings.load()?;
        settings.language = Some(language);
        self.settings.save(&settings)?;
        (self.apply)(language);
        if let Some(runtime) = &self.runtime {
            runtime.set_language(language).await;
        }
        Ok(())
    }
}
