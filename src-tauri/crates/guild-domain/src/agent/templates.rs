//! 役割の固定権限と、作成時に入れる既定値の表（design.md §2）。権限は作成後も役割に従う。
//! テンプレートの ID を書いてよいのはこのファイルだけ（ハーネスが検査）。
//! テンプレートを足すときは、ROWS に1行足すだけでよい（Snapshot.templates で React に届く）。

use super::permissions::Permissions;
use super::template_model::{AgentTemplate, AgentTemplateDefaults};
use super::{name_key, UnmentionedPolicy};

/// 表の1行。accent はテンプレート ID と同じ名前、タグは表示名と同じ1つ（サイドバーの区分になる）
struct Row {
    id: &'static str,
    label: &'static str,
    description: &'static str,
    role: &'static str,
    expertise: &'static str,
    builtin_skills: &'static [&'static str],
    permissions: Permissions,
    unmentioned: UnmentionedPolicy,
    flags: Flags,
}

/// 振る舞いのスイッチ
#[derive(Clone, Copy)]
struct Flags {
    consultable: bool,
    can_delegate: bool,
    autonomy: bool,
}

const QUIET: Flags = Flags { consultable: false, can_delegate: false, autonomy: false };

/// 作業者は対応する全機能を使う。
const FULL_ACCESS: Permissions = Permissions {
    web_search: true,
    web_fetch: true,
    read_files: true,
    write_files: true,
    write_anywhere: true,
    run_commands: true,
    skills: true,
};

/// 発想・評価・進行管理は作業フォルダ内の操作とスキル。Web と外部への書き込みは許さない。
const WORKSPACE_TOOLS: Permissions =
    Permissions { web_search: false, web_fetch: false, write_anywhere: false, ..FULL_ACCESS };

/// UI に並べる順。役割はこの4つだけ。調査や利用者目線は担当・得意分野で表す。
const ROWS: [Row; 4] = [
    Row {
        id: "worker",
        builtin_skills: &[],
        label: "作業者",
        description: "必要なことを調べ、作り、試して、仕事を完成させます。メンションがなくても答えます。",
        role: "必要な調査・制作・実装・動作確認を一連の仕事として進め、完成させる",
        expertise: "",
        permissions: FULL_ACCESS,
        unmentioned: UnmentionedPolicy::Answer,
        flags: QUIET,
    },
    Row {
        id: "ideator",
        builtin_skills: &["concept-shift", "introspection"],
        label: "発想役",
        description: "複数のアイデアや別の切り口を提案します。呼ばれたときに案をまとめて返します。",
        role: "目的に合う複数のアイデアや別の切り口を考える。案ごとの狙いと違いを示し、未確認の仮説は事実と区別して、選べる形でまとめて返す",
        expertise: "アイデア出し・企画・視点の転換",
        permissions: WORKSPACE_TOOLS,
        unmentioned: UnmentionedPolicy::Ignore,
        flags: Flags { consultable: true, ..QUIET },
    },
    Row {
        id: "expert",
        builtin_skills: &["universal-critique"],
        label: "専門家",
        description: "専門知識や指定された目線で案・成果物を評価し、根拠と改善案を返します。",
        role: "専門知識や指定された目線で相談とレビューに答え、完成条件を満たすかを根拠とともに確認し、改善案を示す",
        expertise: "",
        permissions: WORKSPACE_TOOLS,
        unmentioned: UnmentionedPolicy::Fallback,
        flags: Flags { consultable: true, ..QUIET },
    },
    Row {
        id: "manager",
        builtin_skills: &[],
        label: "マネージャー",
        description: "分担が必要かを判断し、方針と担当を決めます。結果を確かめ、まとめて報告します。",
        role: "目的と完成条件を整理し、分担が必要かを判断する。一連の仕事は1人に任せ、独立して進められる部分だけを分担し、結果を検証してまとめる",
        expertise: "方針・優先順位・分担の判断と結果の統合",
        permissions: WORKSPACE_TOOLS,
        unmentioned: UnmentionedPolicy::Lead,
        flags: Flags { can_delegate: true, ..QUIET },
    },
];

/// すべてのテンプレート（UI に並べる順）
pub fn templates() -> Vec<AgentTemplate> {
    ROWS.iter()
        .map(|row| AgentTemplate {
            id: row.id.to_owned(),
            label: row.label.to_owned(),
            description: row.description.to_owned(),
            accent: Some(row.id.to_owned()),
            builtin_skills: row.builtin_skills.iter().map(|name| (*name).to_owned()).collect(),
            defaults: AgentTemplateDefaults {
                tags: vec![row.label.to_owned()],
                role: row.role.to_owned(),
                expertise: row.expertise.to_owned(),
                permissions: row.permissions,
                unmentioned: row.unmentioned,
                consultable: row.flags.consultable,
                can_delegate: row.flags.can_delegate,
                autonomy_enabled: row.flags.autonomy,
            },
        })
        .collect()
}

/// ID でテンプレートを引く（初期データの組み立てなどに使う）
pub fn find_template(id: &str) -> Option<AgentTemplate> {
    templates().into_iter().find(|template| template.id == id)
}

/// 先頭タグに対応する役割。権限とプロンプトの基本の仕事で共通に使う。
pub fn role_template(tags: &[String]) -> Option<AgentTemplate> {
    let head = tags.first().map(|tag| name_key(tag.trim()));
    templates().into_iter().find(|template| template.defaults.tags.first().map(|tag| name_key(tag)) == head)
}
