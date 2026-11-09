//! システム時計: 返すミリ秒は、同じミリ秒のあいだに何度呼んでも必ず増え、別のスレッドから同時に呼んでも重ならない。

use std::collections::HashSet;
use std::sync::Arc;
use std::thread;

use guild_application::ports::Clock;

use crate::infrastructure::clock::SystemClock;

#[test]
fn now_ms_always_increases_even_within_the_same_millisecond() {
    let clock = SystemClock::new();
    let values: Vec<i64> = (0..1000).map(|_| clock.now_ms()).collect();
    assert!(values.windows(2).all(|pair| pair[0] < pair[1]), "呼ぶたびに前より大きい値を返す");
}

#[test]
fn now_ms_never_repeats_across_threads() {
    let clock = Arc::new(SystemClock::new());
    let read = |clock: Arc<SystemClock>| thread::spawn(move || (0..500).map(|_| clock.now_ms()).collect::<Vec<i64>>());
    let handles: Vec<_> = (0..4).map(|_| read(clock.clone())).collect();
    let values: Vec<i64> = handles.into_iter().flat_map(|handle| handle.join().unwrap()).collect();
    let unique: HashSet<i64> = values.iter().copied().collect();
    assert_eq!(unique.len(), values.len(), "同時に呼んでも同じ値を返さない");
}
