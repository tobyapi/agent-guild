use crate::{AppError, AppResult, Ports};
use parking_lot::Mutex;
use std::{collections::VecDeque, sync::Arc, time::Duration};
use tokio::sync::watch;

#[derive(Default)]
struct Jobs {
    active: Option<(String, watch::Sender<bool>)>,
    cancelled: VecDeque<String>,
}
/// The runtime future can be dropped while awaiting a reply (IPC shutdown or cancellation).
struct Reservation<'a>(&'a Mutex<Jobs>);
impl Drop for Reservation<'_> {
    fn drop(&mut self) {
        self.0.lock().active = None;
    }
}
#[derive(Clone)]
pub struct ThemeGenerationService {
    ports: Ports,
    jobs: Arc<Mutex<Jobs>>,
}
impl ThemeGenerationService {
    pub fn new(ports: Ports) -> Self {
        Self { ports, jobs: Arc::default() }
    }
    fn register(&self, id: &str) -> AppResult<watch::Receiver<bool>> {
        let mut jobs = self.jobs.lock();
        if jobs.active.is_some() || jobs.cancelled.iter().any(|key| key == id) {
            return Err(AppError::Runtime("Theme request is busy or cancelled".into()));
        }
        let (tx, rx) = watch::channel(false);
        jobs.active = Some((id.into(), tx));
        Ok(rx)
    }
    pub async fn generate(&self, id: &str, backend: &str, subject: &str) -> AppResult<String> {
        let subject = subject.trim();
        if !valid_id(id) || subject.is_empty() || subject.chars().count() > 200 {
            return Err(AppError::validation("Invalid theme request"));
        }
        if !self.ports.runtime.backends().iter().any(|b| b.id == backend && b.theme_generation && b.is_ready()) {
            return Err(AppError::validation("Theme generator unavailable"));
        }
        let mut cancel = self.register(id)?;
        let _reservation = Reservation(&self.jobs);
        let job = format!("theme-{id}");
        let call = self.ports.runtime.generate_theme(&job, backend, subject);
        let result = tokio::select! {
            biased;
            _=cancel.changed()=>Err(AppError::Runtime("Theme generation cancelled".into())),
            reply=tokio::time::timeout(Duration::from_secs(150),call)=>match reply {
                Ok(Ok(text)) if text.len()<=32768 && !text.is_empty()=>Ok(text),
                _=>Err(AppError::Runtime("Theme generation failed".into())),
            }
        };
        if result.is_err() {
            self.ports.runtime.cancel(&job).await;
        }
        if *cancel.borrow() {
            return Err(AppError::Runtime("Theme generation cancelled".into()));
        }
        result
    }
    pub async fn cancel(&self, id: &str) -> AppResult<()> {
        if !valid_id(id) {
            return Err(AppError::validation("Invalid theme request ID"));
        }
        {
            let mut jobs = self.jobs.lock();
            if let Some((key, tx)) = &jobs.active {
                if key == id {
                    let _ = tx.send(true);
                }
            }
            jobs.cancelled.push_back(id.into());
            if jobs.cancelled.len() > 32 {
                jobs.cancelled.pop_front();
            }
        }
        self.ports.runtime.cancel(&format!("theme-{id}")).await;
        Ok(())
    }
}
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}
