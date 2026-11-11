//! 役割ごとの内蔵スキル: 作成、役割変更、手動編集の保持。
use crate::support::{input, TestApp};
use guild_domain::agent::templates;
use guild_domain::skill::{SkillInput, SkillSource};

#[tokio::test]
async fn every_role_starts_with_linked_builtin_skills() {
    let app = TestApp::new();
    for template in templates() {
        let agent = app.services.agents.create(input(&template.id, &template.label)).unwrap();
        let skills = app.services.skills.list(&agent.id).unwrap();
        let mut names: Vec<_> = skills.iter().map(|skill| skill.name.clone()).collect();
        let mut expected = template.builtin_skills;
        names.sort();
        expected.sort();
        assert_eq!(names, expected);
        assert!(skills
            .iter()
            .all(|skill| skill.problem.is_none()
                && skill.source == Some(SkillSource::Builtin { name: skill.name.clone() })));
    }
}

#[tokio::test]
async fn role_changes_add_missing_skills_without_overwriting_or_readding_on_normal_save() {
    let app = TestApp::new();
    let agent = app.services.agents.create(input("ideator", "ヒラメ")).unwrap();
    let custom = app
        .services
        .skills
        .save(SkillInput {
            id: None,
            agent_id: agent.id.clone(),
            name: "universal-critique".into(),
            description: "自分用".into(),
            body: "独自の手順".into(),
        })
        .unwrap();
    app.services.agents.update(&agent.id, input("expert", "ヒラメ")).unwrap();
    let skills = app.services.skills.list(&agent.id).unwrap();
    assert_eq!(skills.len(), 3);
    assert_eq!(skills.iter().find(|skill| skill.name == "universal-critique"), Some(&custom));
    let critique = skills.iter().find(|skill| skill.name == "universal-critique").unwrap();
    app.services.skills.delete(&critique.id).unwrap();
    app.services.agents.update(&agent.id, input("expert", "名前変更")).unwrap();
    let skills = app.services.skills.list(&agent.id).unwrap();
    assert_eq!(skills.len(), 2, "通常の保存では外したスキルを復活させない");
    assert!(skills.iter().any(|skill| skill.name == "concept-shift"), "以前のスキルは保持する");
}
