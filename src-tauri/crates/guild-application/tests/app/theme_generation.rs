use crate::support::{
    runtime::{ready_backend, THEME_CANDIDATE},
    TestApp,
};
use guild_domain::{backend::BackendInfo, error::ErrorCode};
use serde_json::{json, Value};

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
    assert_eq!(service.generate("second", "colors", " library ").await.unwrap(), THEME_CANDIDATE);
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

#[tokio::test]
async fn theme_generation_rejects_invalid_dividers_and_releases_the_slot() {
    let app = TestApp::new();
    app.runtime.backends.lock().push(BackendInfo { theme_generation: true, ..ready_backend("colors") });
    let service = &app.services.theme_generation;
    let mut draft: Value = serde_json::from_str(THEME_CANDIDATE).unwrap();
    for divider in [
        Value::Null,
        json!({"color":"#fff", "style":"solid", "width":1}),
        json!({"color":"#ffffff", "style":"double", "width":2}),
        json!({"color":"#ffffff", "style":"none", "width":1}),
        json!({"color":"#ffffff", "style":"dashed", "width":"3"}),
        json!({"color":"#ffffff", "style":"dotted", "width":2}),
        json!({"color":"#ffffff", "style":"solid", "width":2, "css":"inherit"}),
    ] {
        draft["variants"]["light"]["divider"] = divider;
        *app.runtime.theme_response.lock() = Some(draft.to_string());
        let error = service.generate("invalid", "colors", "library").await.unwrap_err().to_command_error();
        assert_eq!(error.code, ErrorCode::Validation);
        assert_eq!(error.field.as_deref(), Some("candidate"));
    }
    draft["variants"]["light"]["divider"] = json!({"color":"#ffffff", "style":"none", "width":0});
    let draft = draft.to_string();
    *app.runtime.theme_response.lock() = Some(draft.clone());
    assert_eq!(service.generate("next", "colors", "library").await.unwrap(), draft);
}

#[tokio::test]
async fn theme_generation_accepts_only_the_current_candidate_schema() {
    let app = TestApp::new();
    app.runtime.backends.lock().push(BackendInfo { theme_generation: true, ..ready_backend("colors") });
    let service = &app.services.theme_generation;
    let mut draft: Value = serde_json::from_str(THEME_CANDIDATE).unwrap();
    for version in [1, 3] {
        draft["schemaVersion"] = json!(version);
        *app.runtime.theme_response.lock() = Some(draft.to_string());
        let error = service.generate("invalid", "colors", "library").await.unwrap_err().to_command_error();
        assert_eq!(error.code, ErrorCode::Validation);
        assert_eq!(error.field.as_deref(), Some("candidate"));
    }
    *app.runtime.theme_response.lock() = Some(THEME_CANDIDATE.to_owned());
    assert_eq!(service.generate("next", "colors", "library").await.unwrap(), THEME_CANDIDATE);
}
