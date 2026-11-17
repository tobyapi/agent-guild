use super::RunnerRuntime;
use base64::{engine::general_purpose::STANDARD, Engine};
use guild_application::ports::RuntimeError;

impl RunnerRuntime {
    pub(super) async fn draw_background(&self, id: &str, backend: &str, prompt: &str) -> Result<Vec<u8>, RuntimeError> {
        let request = runner_client::BackgroundRequest { backend: backend.into(), prompt: prompt.into() };
        let result = self.client.generate_background(id, request).await.map_err(super::failure::error)?;
        let max = guild_domain::attachment::MAX_IMAGE_BYTES;
        if result.len() > max.div_ceil(3) * 4 {
            return Err(RuntimeError::Failed("Background image exceeds 5 MiB".into()));
        }
        let bytes = STANDARD.decode(&result).map_err(|_| RuntimeError::Failed("Invalid background data".into()))?;
        if bytes.is_empty() || bytes.len() > max {
            return Err(RuntimeError::Failed("Invalid background size".into()));
        }
        Ok(bytes)
    }
}
