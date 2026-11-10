use guild_application::ports::RuntimeError;
use guild_domain::statistics::RunUsage;

use crate::support::{runtime::Script, TestApp};

#[tokio::test]
async fn records_known_usage_and_the_resolved_model_even_if_the_run_fails() {
    let app = TestApp::new();
    let worker = app.agent("worker", "ハル");
    let channel = app.channel("ロビー", &[&worker]);
    app.runtime.script(
        worker.id.as_str(),
        Script::Measured(
            vec![
                RunUsage { model: Some("resolved-model".to_owned()), input_tokens: Some(40), ..RunUsage::default() },
                RunUsage {
                    input_tokens: Some(2),
                    output_tokens: Some(0),
                    estimated_cost_nano_usd: Some(2000),
                    ..RunUsage::default()
                },
            ],
            Err(RuntimeError::Failed("テストの実行エラー".to_owned())),
        ),
    );
    let trigger = app.services.conversation.send_human_message(&channel.id, "@ハル 返事して", &[]).unwrap();
    app.settle().await;
    let measurements = app.store.measurements.lock();
    assert_eq!(measurements.len(), 1);
    let run = &measurements[0];
    assert_eq!(run.channel_id, channel.id);
    assert!(run.started_at >= trigger.created_at);
    assert_eq!(
        run.usage,
        RunUsage {
            model: Some("resolved-model".to_owned()),
            input_tokens: Some(42),
            output_tokens: Some(0),
            estimated_cost_nano_usd: Some(2000)
        }
    );
}
