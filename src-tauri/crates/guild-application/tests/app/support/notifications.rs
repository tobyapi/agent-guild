use guild_application::{ports::DesktopNotifier, AppError, AppResult};
use parking_lot::Mutex;
#[derive(Default)]
pub struct FakeNotifier {
    pub calls: Mutex<Vec<(String, String)>>,
    pub fail: Mutex<bool>,
}
impl DesktopNotifier for FakeNotifier {
    fn submit(&self, title: &str, body: &str) -> AppResult<()> {
        self.calls.lock().push((title.to_owned(), body.to_owned()));
        if *self.fail.lock() {
            Err(AppError::Storage("OS rejected".to_owned()))
        } else {
            Ok(())
        }
    }
}
