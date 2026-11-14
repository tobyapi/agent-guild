//! 役割の固定権限と、作成時に入れる既定値の表（design.md §2）。権限は作成後も役割に従う。
//! テンプレートの ID を書いてよいのはこのファイルだけ（ハーネスが検査）。
//! テンプレートを足すときは、ROWS に1行足すだけでよい（Snapshot.templates で React に届く）。

use super::permissions::Permissions;
use super::template_model::{AgentTemplate, AgentTemplateDefaults};
use super::template_texts::{self as texts, Texts};
use super::{name_key, UnmentionedPolicy};
use crate::locale;

/// 表の1行。accent はテンプレート ID と同じ名前、タグは表示名と同じ1つ（サイドバーの区分になる）
struct Row {
    id: &'static str,
    /// 表示名（日本語・英語・簡体字・繁体字・韓国語）。作成時のタグはいまの言語のもの。どの言語のタグでも同じ役割になる
    label: Texts,
    /// 説明（同じ順）
    description: Texts,
    role: Texts,
    expertise: Texts,
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
    read_anywhere: false,
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
        label: ["作業者", "Worker", "执行者", "執行者", "작업자"],
        description: [
            "必要なことを調べ、作り、試して、仕事を完成させます。メンションがなくても答えます。",
            "Researches, builds, and tests whatever is needed to finish the job. Answers even without a mention.",
            "调查、制作并测试所需的内容，完成工作。即使没有提及也会回答。",
            "調查、製作並測試所需的內容，完成工作。即使沒有提及也會回答。",
            "필요한 것을 조사하고 만들고 시험하여 일을 완성합니다. 멘션이 없어도 답합니다.",
        ],
        role: texts::WORKER_ROLE,
        expertise: texts::EMPTY,
        permissions: FULL_ACCESS,
        unmentioned: UnmentionedPolicy::Answer,
        flags: QUIET,
    },
    Row {
        id: "ideator",
        builtin_skills: &["concept-shift", "introspection"],
        label: ["発想役", "Ideator", "创意者", "發想者", "아이디어 담당"],
        description: [
            "複数のアイデアや別の切り口を提案します。呼ばれたときに案をまとめて返します。",
            "Proposes multiple ideas and alternative angles. When called on, returns the options in summary.",
            "提出多个创意和不同的切入点。被叫到时整理好方案后回复。",
            "提出多個點子和不同的切入點。被呼叫時整理好方案後回覆。",
            "여러 아이디어와 다른 관점을 제안합니다. 호출되면 안을 정리해서 답합니다.",
        ],
        role: texts::IDEATOR_ROLE,
        expertise: texts::IDEATOR_EXPERTISE,
        permissions: WORKSPACE_TOOLS,
        unmentioned: UnmentionedPolicy::Ignore,
        flags: Flags { consultable: true, ..QUIET },
    },
    Row {
        id: "expert",
        builtin_skills: &["universal-critique"],
        label: ["専門家", "Expert", "专家", "專家", "전문가"],
        description: [
            "専門知識や指定された目線で案・成果物を評価し、根拠と改善案を返します。",
            "Evaluates proposals and deliverables with expert knowledge or a given perspective, returning reasons and improvements.",
            "以专业知识或指定的视角评估方案和成果，并给出依据和改进建议。",
            "以專業知識或指定的觀點評估方案和成果，並提出依據和改善建議。",
            "전문 지식이나 지정된 관점으로 안과 결과물을 평가하고, 근거와 개선안을 제시합니다.",
        ],
        role: texts::EXPERT_ROLE,
        expertise: texts::EMPTY,
        permissions: Permissions { read_anywhere: true, ..WORKSPACE_TOOLS },
        unmentioned: UnmentionedPolicy::Fallback,
        flags: Flags { consultable: true, ..QUIET },
    },
    Row {
        id: "manager",
        builtin_skills: &["universal-manager"],
        label: ["マネージャー", "Manager", "经理", "經理", "매니저"],
        description: [
            "分担が必要かを判断し、方針と担当を決めます。結果を確かめ、まとめて報告します。",
            "Decides whether work needs to be split, then sets the direction and responsibilities. Checks the results and reports a summary.",
            "判断是否需要分工，并确定方针和职责。核实结果后汇总报告。",
            "判斷是否需要分工，並決定方針和職責。確認結果後彙整報告。",
            "분담이 필요한지 판단하고 방침과 담당을 정합니다. 결과를 확인하고 정리해서 보고합니다.",
        ],
        role: texts::MANAGER_ROLE,
        expertise: texts::MANAGER_EXPERTISE,
        permissions: Permissions { read_anywhere: true, ..WORKSPACE_TOOLS },
        unmentioned: UnmentionedPolicy::Lead,
        flags: Flags { can_delegate: true, ..QUIET },
    },
];

/// すべてのテンプレート（UI に並べる順）
pub fn templates() -> Vec<AgentTemplate> {
    ROWS.iter()
        .map(|row| AgentTemplate {
            id: row.id.to_owned(),
            label: locale::pick(row.label).to_owned(),
            description: locale::pick(row.description).to_owned(),
            accent: Some(row.id.to_owned()),
            builtin_skills: row.builtin_skills.iter().map(|name| (*name).to_owned()).collect(),
            role_tags: row.label.iter().map(|label| (*label).to_owned()).collect(),
            defaults: AgentTemplateDefaults {
                tags: vec![locale::pick(row.label).to_owned()],
                role: locale::pick(row.role).to_owned(),
                expertise: locale::pick(row.expertise).to_owned(),
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
/// どの言語の表示名のタグでも同じ役割になる（作成したときの言語のタグが保存されている）
pub fn role_template(tags: &[String]) -> Option<AgentTemplate> {
    let head = name_key(tags.first()?.trim());
    templates().into_iter().find(|template| template.role_tags.iter().any(|tag| name_key(tag) == head))
}
