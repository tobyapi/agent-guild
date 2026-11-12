//! アバターの枠: ID の形・生成を頼む説明・名前・プロンプト・枠のスキル（内蔵スキル）・穴の決まり・絵の種類の JSON。

use guild_domain::frame::{
    custom_frame_id, frame_name, frame_prompt, normalize_frame_description, normalize_frame_id, CustomFrame, FrameArt,
    FrameImageProblem, FRAME_IMAGE_MAX_SIDE, FRAME_OPENING_INSET, FRAME_OPENING_RADIUS, FRAME_SKILL_NAME,
    FRAME_SOURCE_MAX_SIDE, FRAME_SOURCE_MIN_SIDE, FRAME_VIEWBOX,
};
use guild_domain::skill::find_builtin_skill;
use serde_json::json;

#[test]
fn frame_ids_are_empty_builtin_or_custom() {
    assert_eq!(normalize_frame_id("").unwrap(), "");
    assert_eq!(normalize_frame_id("  builtin:rose ").unwrap(), "builtin:rose");
    assert_eq!(normalize_frame_id("custom:1b2c-3d").unwrap(), "custom:1b2c-3d");
    assert_eq!(custom_frame_id("abc"), "custom:abc");
    for bad in ["rose", "builtin:", "custom:../x", "builtin:<svg>", "other:rose", &format!("custom:{}", "a".repeat(65))]
    {
        let error = normalize_frame_id(bad).expect_err(bad);
        assert_eq!(error.field(), Some("frame"), "{bad}");
    }
}

#[test]
fn descriptions_are_required_and_limited() {
    assert_eq!(normalize_frame_description("  月夜の薔薇と鎖 ").unwrap(), "月夜の薔薇と鎖");
    assert_eq!(normalize_frame_description("   ").unwrap_err().field(), Some("description"));
    assert_eq!(normalize_frame_description(&"あ".repeat(201)).unwrap_err().field(), Some("description"));
    assert!(normalize_frame_description(&"あ".repeat(200)).is_ok());
}

#[test]
fn names_fall_back_to_the_description() {
    assert_eq!(frame_name(" 夜の鎖 ", "どうでもよい"), "夜の鎖");
    assert_eq!(frame_name("", "月夜の薔薇と鎖\n二行目"), "月夜の薔薇と鎖");
    assert_eq!(frame_name("", &"長".repeat(40)).chars().count(), 24);
}

#[test]
fn the_prompt_only_names_the_builtin_skill_and_passes_the_theme_and_the_output() {
    let prompt = frame_prompt("月夜の薔薇と鎖", "/data/tools/frames/work/frame.png");
    assert_eq!(FRAME_SKILL_NAME, "ornate-avatar-frame");
    assert_eq!(
        prompt,
        "$ornate-avatar-frame でアイコンの枠を1つ生成して。テーマ: 月夜の薔薇と鎖\n\
         完成した枠の PNG は /data/tools/frames/work/frame.png に保存して。"
    );
    // スキルを上書きしない（大きさ・穴・背景・手順の決まりを足さない）
    for rule in ["1024", "64", "magenta", "#FF00FF", "exactly once", "px", "%"] {
        assert!(!prompt.contains(rule), "{rule}: {prompt}");
    }
}

#[test]
fn the_frame_skill_is_a_builtin_skill() {
    let skill = find_builtin_skill(FRAME_SKILL_NAME).expect("内蔵スキルにある");
    assert!(skill.description.contains("アバターフレーム"));
    assert!(skill.body.starts_with("# 装飾アイコン枠"));
    for section in ["## 構図と質感", "## 生成と修正", "## PNGの確認と納品"] {
        assert!(skill.body.contains(section), "{section}");
    }
}

#[test]
fn the_opening_matches_the_builtin_frames() {
    // 穴は内蔵の枠と同じ割合（128 の中の 20〜108・角の半径 10）。受け取る画像はスキルの既定の 64px を含む
    assert_eq!((FRAME_VIEWBOX, FRAME_OPENING_INSET, FRAME_OPENING_RADIUS), (128, 20, 10));
    assert!((FRAME_SOURCE_MIN_SIDE..=FRAME_SOURCE_MAX_SIDE).contains(&64));
    assert_eq!(FRAME_IMAGE_MAX_SIDE, 512);
}

#[test]
fn custom_frames_carry_their_kind() {
    let svg = CustomFrame {
        id: "custom:a".to_owned(),
        name: "薔薇".to_owned(),
        art: FrameArt::Svg { svg: "<svg/>".to_owned() },
        created_at: 1,
    };
    let png = CustomFrame { id: "custom:b".to_owned(), name: "鎖".to_owned(), art: FrameArt::Png, created_at: 2 };
    let svg_json = json!({ "id": "custom:a", "name": "薔薇", "kind": "svg", "svg": "<svg/>", "createdAt": 1 });
    let png_json = json!({ "id": "custom:b", "name": "鎖", "kind": "png", "createdAt": 2 });
    assert_eq!(serde_json::to_value(&svg).unwrap(), svg_json);
    assert_eq!(serde_json::to_value(&png).unwrap(), png_json);
    assert_eq!(serde_json::from_value::<CustomFrame>(png_json).unwrap(), png);
}

#[test]
fn image_problems_have_messages() {
    for problem in [
        FrameImageProblem::Missing,
        FrameImageProblem::TooLarge,
        FrameImageProblem::NotPng,
        FrameImageProblem::BadSize,
        FrameImageProblem::Background,
        FrameImageProblem::NoFrame,
    ] {
        assert!(!problem.message().is_empty(), "{problem:?}");
    }
}
