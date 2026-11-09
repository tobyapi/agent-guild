//! 自発活動のスケジューラ（design.md §10）: 30秒ごとに AutonomyService::tick を呼ぶ。

use std::sync::Arc;
use std::time::Duration;

use guild_application::autonomy::AutonomyService;
use guild_application::ports::{Clock, Spawner};
use tokio::time::{interval_at, Instant, MissedTickBehavior};

pub const TICK_INTERVAL: Duration = Duration::from_secs(30);

pub fn start(autonomy: AutonomyService, clock: Arc<dyn Clock>, spawner: &dyn Spawner) {
    spawner.spawn(Box::pin(async move {
        let mut ticks = interval_at(Instant::now() + TICK_INTERVAL, TICK_INTERVAL);
        ticks.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            ticks.tick().await;
            match autonomy.tick(clock.now_ms()).await {
                Ok(0) => {}
                Ok(count) => log::info!("自発活動を {count} 件積みました"),
                Err(error) => log::warn!("自発活動の判定に失敗しました: {error}"),
            }
        }
    }));
}
