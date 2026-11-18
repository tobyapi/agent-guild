use crate::support::{runtime::ready_backend, TestApp};
use guild_domain::backend::BackendInfo;

#[tokio::test]
async fn theme_generation_checks_capability_and_cancellation_before_dispatch() {
    let app = TestApp::new();
    let service = &app.services.theme_generation;
    app.runtime.backends.lock().push(ready_backend("colors"));
    assert!(service.generate("first", "colors", "library").await.is_err());
    app.runtime.backends.lock()[0] = BackendInfo { theme_generation: true, ..ready_backend("colors") };
    service.cancel("early").await.unwrap();
    assert!(service.generate("early", "colors", "library").await.is_err());
    assert!(service.generate("invalid/id", "colors", "library").await.is_err());
    assert!(app.runtime.theme_requests.lock().is_empty());
    assert_eq!(service.generate("second", "colors", " library ").await.unwrap(), "theme JSON");
    assert_eq!(app.runtime.theme_requests.lock()[0], ("theme-second".into(), "colors".into(), "library".into()));
}
#[tokio::test]
async fn dropping_or_cancelling_a_theme_releases_its_slot() {
    let app = TestApp::new();
    app.runtime.backends.lock().push(BackendInfo { theme_generation: true, ..ready_backend("colors") });
    let service = &app.services.theme_generation;
    for cancel in [false, true] {
        let mut pending = Box::pin(service.generate("pending", "colors", "wait"));
        tokio::select! { biased; reply=&mut pending=>panic!("unexpected result {reply:?}"), ()=std::future::ready(())=>{} }
        assert!(service.generate("busy", "colors", "wait").await.is_err());
        if cancel {
            service.cancel("pending").await.unwrap();
            assert!(pending.await.is_err());
        } else {
            drop(pending);
        }
        assert!(service.generate("next", "colors", "library").await.is_ok());
    }
}
