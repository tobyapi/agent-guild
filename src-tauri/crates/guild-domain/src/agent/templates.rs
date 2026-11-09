//! エージェント作成のテンプレート表（design.md §2）。作成時に値を一括で入れるだけのプリセットで、作成後の
//! エージェントはテンプレートと結びつかない。テンプレートの ID を書いてよいのはこのファイルだけ（ハーネスが検査）。
//! テンプレートを足すときは、ROWS に1行足すだけでよい（Snapshot.templates で React に届く）。

use super::permissions::Permissions;
use super::template_model::{AgentTemplate, AgentTemplateDefaults};
use super::UnmentionedPolicy;

/// 表の1行。accent はテンプレート ID と同じ名前、タグは表示名と同じ1つ（サイドバーの区分になる）
struct Row {
    id: &'static str,
    label: &'static str,
    description: &'static str,
    role: &'static str,
    expertise: &'static str,
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

/// 読む・調べる・スキルを使う（書き込みとコマンドなし）
const READER: Permissions = Permissions {
    web_search: true,
    web_fetch: true,
    read_files: true,
    write_files: false,
    write_anywhere: false,
    run_commands: false,
    skills: true,
};

/// UI に並べる順
const ROWS: [Row; 7] = [
    Row {
        id: "worker",
        label: "作業者",
        description: "頼まれた作業を、手を動かして進めます。メンションがなくても答えます。",
        role: "頼まれた作業を手を動かして進める",
        expertise: "",
        permissions: Permissions { write_files: true, ..READER },
        unmentioned: UnmentionedPolicy::Answer,
        flags: QUIET,
    },
    Row {
        id: "expert",
        label: "専門家",
        description: "得意分野の相談とレビューに答えます。ほかのエージェントに呼ばれると参加します。",
        role: "専門分野の相談とレビューに答える",
        expertise: "",
        permissions: READER,
        unmentioned: UnmentionedPolicy::Fallback,
        flags: Flags { consultable: true, ..QUIET },
    },
    Row {
        id: "manager",
        label: "マネージャー",
        description: "依頼を分けて、適任のメンバーに割り振ります。結果がそろったら、まとめて報告します。",
        role: "依頼を分解して適任者に割り振り、結果をまとめて報告する",
        expertise: "段取りと進行管理",
        permissions: Permissions { web_fetch: false, ..READER },
        unmentioned: UnmentionedPolicy::Lead,
        flags: Flags { can_delegate: true, ..QUIET },
    },
    Row {
        id: "researcher",
        label: "調査係",
        description: "Web で調べて、出典つきで要点をまとめます。ファイルは書かず、コマンドも使いません。",
        role: "Web で調べて、出典つきで要点をまとめる",
        expertise: "Web 調査と情報の整理",
        permissions: READER,
        unmentioned: UnmentionedPolicy::Ignore,
        flags: Flags { consultable: true, ..QUIET },
    },
    Row {
        id: "scribe",
        label: "書記",
        description: "議論をときどき要約して、決まったことと残った論点を書き残します。",
        role: "チャンネルの議論を定期的に要約し、決定事項と未解決の論点を残す",
        expertise: "議事の要約と記録",
        permissions: Permissions { web_search: false, web_fetch: false, write_files: true, ..READER },
        unmentioned: UnmentionedPolicy::Ignore,
        flags: Flags { autonomy: true, ..QUIET },
    },
    Row {
        id: "critic",
        label: "批判役",
        description: "案の弱点やリスクを、あえて率直に指摘します。呼ばれたときだけ話します。",
        role: "案の弱点・リスク・反対意見をあえて率直に出す",
        expertise: "リスクの洗い出しと反論",
        permissions: Permissions { web_fetch: false, ..READER },
        unmentioned: UnmentionedPolicy::Ignore,
        flags: Flags { consultable: true, ..QUIET },
    },
    Row {
        id: "enduser",
        label: "エンドユーザー役",
        description: "初めて使う人の目線で、感想と困りごとを伝えます。呼ばれたときだけ話します。",
        role: "想定ユーザーとして、初めて見る立場で感想と困りごとを伝える",
        expertise: "初めて使う人の目線",
        permissions: Permissions { web_search: false, web_fetch: false, skills: false, ..READER },
        unmentioned: UnmentionedPolicy::Ignore,
        flags: Flags { consultable: true, ..QUIET },
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
