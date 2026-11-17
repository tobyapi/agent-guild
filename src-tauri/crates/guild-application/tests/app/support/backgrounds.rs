use guild_application::ports::RuntimeError;
use parking_lot::Mutex;
use std::collections::VecDeque;

#[derive(Default)]
pub struct BackgroundRenderer {
    pub requests: Mutex<Vec<(String, String, String)>>,
    pub cancelled: Mutex<Vec<String>>,
    pub results: Mutex<VecDeque<Result<Vec<u8>, RuntimeError>>>,
    pub hang: Mutex<bool>,
}
impl BackgroundRenderer {
    pub async fn draw(&self, id: &str, backend: &str, prompt: &str) -> Result<Vec<u8>, RuntimeError> {
        self.requests.lock().push((id.into(), backend.into(), prompt.into()));
        if *self.hang.lock() {
            std::future::pending::<()>().await;
        }
        self.results.lock().pop_front().unwrap_or(Ok(vec![1, 2, 3]))
    }
}
