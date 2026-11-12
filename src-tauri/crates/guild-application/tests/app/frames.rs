//! アイコンの枠: AI に描いてもらった画像の取り込みと保存・権限を持たない画像の依頼（内蔵スキルの枠のスキルをそのまま
//! 添え、プロンプトはスキルを名指ししてテーマと保存先を渡すだけ）・取り消しと時間切れ・絵の読み出し・削除。

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use guild_application::frames::FRAME_GENERATION_TIMEOUT;
use guild_application::AppError;
use guild_domain::backend::{BackendInfo, BackendStatus};
use guild_domain::frame::{CustomFrame, FrameArt, FrameImageProblem, FRAME_SKILL_NAME};
use guild_domain::profile::Profile;
use guild_domain::skill::{builtin_skill_files, find_builtin_skill};

use crate::support::frames::ImageScript;
use crate::support::runtime::ready_backend;
use crate::support::TestApp;

/// 枠の生成を申告するバックエンド（TestApp の claude は申告しない）
const PAINTER: &str = "painter";

fn painting_app() -> TestApp {
    let app = TestApp::new();
    app.runtime.backends.lock().push(BackendInfo { frame_generation: true, ..ready_backend(PAINTER) });
    app
}

fn script(app: &TestApp, script: ImageScript) {
    app.runtime.image_scripts.lock().push_back(script);
}

#[tokio::test]
async fn generating_draws_one_image_and_imports_it_as_a_png_frame() {
    let app = painting_app();
    let before = app.events.state_changes.load(Ordering::SeqCst);
    let frame = app.services.frames.generate(PAINTER, " 月夜の薔薇と鎖 ", "").await.unwrap();
    assert!(frame.id.starts_with("custom:"), "{}", frame.id);
    assert_eq!((frame.name.as_str(), &frame.art), ("月夜の薔薇と鎖", &FrameArt::Png));
    assert_eq!(app.services.snapshot.get().unwrap().frames, vec![frame.clone()]);
    assert_eq!(app.events.state_changes.load(Ordering::SeqCst), before + 1);

    let request = app.runtime.image_requests.lock().remove(0);
    assert_eq!(request.backend, PAINTER);
    assert!(request.output.starts_with(&request.workspace), "PNG はモデルが書ける作業場所の中に保存してもらう");
    let expected = format!(
        "${FRAME_SKILL_NAME} でアイコンの枠を1つ生成して。テーマ: 月夜の薔薇と鎖\n完成した枠の PNG は {} に保存して。",
        request.output.display()
    );
    assert_eq!(request.prompt, expected, "スキルを名指ししてテーマと保存先を渡すだけ（大きさなどの決まりを足さない）");
    assert_eq!(request.system_prompt, "", "スキルの手順を狭める決まりを置かない");
    assert!(app.runtime.requests.lock().is_empty(), "会話の実行（権限つきの run）は使わない");
    assert_eq!(app.frame_images.stored.lock().get(&frame.id), Some(&request.output));
    assert_eq!(app.services.frames.image(&frame.id).unwrap(), format!("png:{}", request.output.display()).into_bytes());
}

#[tokio::test]
async fn the_request_carries_the_builtin_frame_skill_as_is() {
    let app = painting_app();
    app.services.frames.generate(PAINTER, "潮だまり", "").await.unwrap();
    let request = app.runtime.image_requests.lock().remove(0);
    let [skill] = request.skills.as_slice() else { panic!("スキルは1つ: {:?}", request.skills) };
    // 内蔵スキルの一覧のものをそのまま（付属ファイルがあれば、エージェントの実行と同じく中身ごと）
    let builtin = find_builtin_skill(FRAME_SKILL_NAME).unwrap();
    assert!(builtin.description.starts_with("ゲームやプロフィールのアイコンに重ねる"));
    assert_eq!((&skill.name, &skill.description, &skill.body), (&builtin.name, &builtin.description, &builtin.body));
    let files: Vec<String> = skill.files.iter().map(|file| file.path.clone()).collect();
    let bundled: Vec<String> = builtin_skill_files(FRAME_SKILL_NAME).into_iter().map(|file| file.path).collect();
    assert_eq!((skill.dir.as_ref(), files), (None, bundled));
}

#[tokio::test]
async fn a_given_name_is_used() {
    let app = painting_app();
    let frame = app.services.frames.generate(PAINTER, "月夜の薔薇", " 夜会の枠 ").await.unwrap();
    assert_eq!(frame.name, "夜会の枠");
}

#[tokio::test]
async fn unusable_or_missing_images_are_not_saved() {
    let app = painting_app();
    for problem in [FrameImageProblem::Missing, FrameImageProblem::Background] {
        *app.frame_images.problem.lock() = Some(problem);
        let error = app.services.frames.generate(PAINTER, "月夜の薔薇", "").await.unwrap_err();
        let AppError::Runtime(message) = error else { panic!("{error:?}") };
        assert!(message.contains(problem.message()), "{message}");
    }
    assert!(app.store.frames.lock().is_empty());
    assert!(app.frame_images.stored.lock().is_empty());
}

#[tokio::test]
async fn only_png_frames_have_images() {
    let app = painting_app();
    let old = CustomFrame {
        id: "custom:old".to_owned(),
        name: "以前の枠".to_owned(),
        art: FrameArt::Svg { svg: "<svg/>".to_owned() },
        created_at: 1,
    };
    app.store.frames.lock().push(old.clone());
    assert!(matches!(app.services.frames.image(&old.id), Err(AppError::NotFound(_))));
    assert!(matches!(app.services.frames.image("custom:none"), Err(AppError::NotFound(_))));
    // 以前の版の SVG の枠も消せる
    app.services.frames.delete(&old.id).unwrap();
    assert!(app.store.frames.lock().is_empty());
}

#[tokio::test]
async fn backends_that_are_not_ready_or_unknown_are_refused() {
    let app = painting_app();
    app.runtime.backends.lock().iter_mut().for_each(|backend| backend.status = BackendStatus::NeedsAuth);
    for backend in [PAINTER, "nothing"] {
        let error = app.services.frames.generate(backend, "月夜の薔薇", "").await.unwrap_err();
        let AppError::Validation(error) = error else { panic!("{error:?}") };
        assert_eq!(error.field(), Some("backendId"));
    }
    assert!(app.runtime.image_requests.lock().is_empty(), "描かせない");
}

#[tokio::test]
async fn backends_that_do_not_declare_frame_generation_are_refused_even_when_ready() {
    let app = painting_app();
    let error = app.services.frames.generate("claude", "月夜の薔薇", "").await.unwrap_err();
    let AppError::Validation(error) = error else { panic!("{error:?}") };
    assert_eq!(error.field(), Some("backendId"));
    let not_ready = app.services.frames.generate("nothing", "月夜の薔薇", "").await.unwrap_err();
    assert_ne!(AppError::Validation(error), not_ready, "使えない理由を分けて伝える");
    assert!(app.runtime.image_requests.lock().is_empty(), "描かせない");
}

#[tokio::test]
async fn empty_descriptions_are_refused() {
    let app = painting_app();
    let error = app.services.frames.generate(PAINTER, "  ", "").await.unwrap_err();
    assert!(matches!(&error, AppError::Validation(e) if e.field() == Some("description")), "{error:?}");
}

#[tokio::test]
async fn failures_of_the_backend_are_reported() {
    let app = painting_app();
    script(&app, ImageScript::Fail("Codex は画像を作らずに終わりました".to_owned()));
    let error = app.services.frames.generate(PAINTER, "月夜の薔薇", "").await.unwrap_err();
    assert_eq!(error, AppError::Runtime("Codex は画像を作らずに終わりました".to_owned()));
}

#[tokio::test]
async fn generation_can_be_cancelled() {
    let app = Arc::new(painting_app());
    script(&app, ImageScript::Hang);
    let running = {
        let app = app.clone();
        tokio::spawn(async move { app.services.frames.generate(PAINTER, "月夜の薔薇", "").await })
    };
    while app.runtime.image_requests.lock().is_empty() {
        tokio::time::sleep(Duration::from_millis(1)).await;
    }
    app.services.frames.cancel_generation().await;
    let error = running.await.unwrap().unwrap_err();
    assert!(matches!(error, AppError::Runtime(_)), "{error:?}");
    assert!(app.store.frames.lock().is_empty());
}

#[tokio::test(start_paused = true)]
async fn generation_stops_when_no_answer_comes_back_in_time() {
    let app = painting_app();
    script(&app, ImageScript::Hang);
    let generating = app.services.frames.generate(PAINTER, "月夜の薔薇", "");
    let (result, ()) = tokio::join!(generating, tokio::time::sleep(FRAME_GENERATION_TIMEOUT + Duration::from_secs(1)));
    assert!(matches!(result, Err(AppError::Runtime(_))));
    assert_eq!(app.runtime.cancelled.lock().len(), 1, "中断を頼む");
}

#[tokio::test]
async fn deleting_a_frame_removes_its_image_and_returns_its_wearers_to_no_frame() {
    let app = painting_app();
    let frame = app.services.frames.generate(PAINTER, "月夜の薔薇", "").await.unwrap();
    let mut input = crate::support::input("worker", "ハル");
    input.frame = frame.id.clone();
    let hal = app.services.agents.create(input).unwrap();
    assert_eq!(hal.frame, frame.id);
    let me = Profile { frame: frame.id.clone(), ..Profile::default() };
    app.services.profile.update(me).unwrap();

    app.services.frames.delete(&frame.id).unwrap();
    assert!(app.frame_images.stored.lock().is_empty(), "絵のファイルも消す");
    let snapshot = app.services.snapshot.get().unwrap();
    assert!(snapshot.frames.is_empty());
    assert_eq!(snapshot.agents[0].frame, "");
    assert_eq!(snapshot.me.frame, "");
    assert!(matches!(app.services.frames.delete(&frame.id), Err(AppError::NotFound(_))));
}

#[tokio::test]
async fn members_keep_their_chosen_frame_and_bad_ids_are_refused() {
    let app = TestApp::new();
    let mut input = crate::support::input("worker", "ハル");
    input.frame = " builtin:rose ".to_owned();
    assert_eq!(app.services.agents.create(input.clone()).unwrap().frame, "builtin:rose");
    input.name = "ソラ".to_owned();
    input.frame = "https://example.com/frame.svg".to_owned();
    let error = app.services.agents.create(input).unwrap_err();
    assert!(matches!(&error, AppError::Validation(e) if e.field() == Some("frame")), "{error:?}");
    let error = app.services.profile.update(Profile { frame: "<svg>".to_owned(), ..Profile::default() }).unwrap_err();
    assert!(matches!(&error, AppError::Validation(e) if e.field() == Some("frame")), "{error:?}");
}
