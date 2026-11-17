//! Manual smoke check of the production OS adapter; no guild database, runner or settings are opened.
#[path = "../src/infrastructure/notifications.rs"]
mod notifications;
use guild_application::ports::DesktopNotifier;
use notifications::TauriNotifier;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let identifier = config["identifier"].as_str().ok_or("missing app identifier")?;
    TauriNotifier(identifier.to_owned())
        .submit("AI Guild notification test", "Desktop notification verification · 2026-11-17")?;
    println!("OS_SUBMITTED (display unconfirmed)");
    Ok(())
}
