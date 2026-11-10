// モックの「Rust のテンプレートの表」（contracts/ipc/snapshot.json と docs/design.md §2 の表に合わせる）。
// テンプレート ID と accent はこの表の中だけで使い、コードの振る舞いを分けない。
import type { AgentTemplate, AgentTemplateDefaults, PermissionKey, Permissions } from '@/shared/types/domain';

const NONE: Permissions = {
  webSearch: false,
  webFetch: false,
  readFiles: false,
  writeFiles: false,
  writeAnywhere: false,
  runCommands: false,
  skills: false,
};

const allow = (...keys: PermissionKey[]): Permissions => ({
  ...NONE,
  ...Object.fromEntries(keys.map((key) => [key, true])),
});

const WORKSPACE_TOOLS = allow('readFiles', 'writeFiles', 'runCommands', 'skills');

type Settings = Omit<AgentTemplateDefaults, 'tags' | 'consultable' | 'canDelegate' | 'autonomyEnabled'> &
  Partial<Pick<AgentTemplateDefaults, 'consultable' | 'canDelegate' | 'autonomyEnabled'>>;

function template(id: string, label: string, description: string, settings: Settings): AgentTemplate {
  return {
    id,
    label,
    description,
    accent: id,
    defaults: { tags: [label], consultable: false, canDelegate: false, autonomyEnabled: false, ...settings },
  };
}

export const MOCK_TEMPLATES: AgentTemplate[] = [
  template('worker', '作業者', '頼まれた作業を、手を動かして進めます。メンションがなくても答えます。', {
    role: '頼まれた作業を手を動かして進める',
    expertise: '',
    permissions: { ...WORKSPACE_TOOLS, webSearch: true, webFetch: true, writeAnywhere: true },
    unmentioned: 'answer',
  }),
  template('expert', '専門家', '得意分野の相談とレビューに答えます。ほかのエージェントに呼ばれると参加します。', {
    role: '専門分野の相談とレビューに答える',
    expertise: '',
    permissions: WORKSPACE_TOOLS,
    unmentioned: 'fallback',
    consultable: true,
  }),
  template(
    'manager',
    'マネージャー',
    '依頼を分けて、適任のメンバーに割り振ります。結果がそろったら、まとめて報告します。',
    {
      role: '依頼を分解して適任者に割り振り、結果をまとめて報告する',
      expertise: '段取りと進行管理',
      permissions: WORKSPACE_TOOLS,
      unmentioned: 'lead',
      canDelegate: true,
    },
  ),
  template(
    'researcher',
    '調査係',
    'Web で調べて、出典つきで要点をまとめます。ファイルは書かず、コマンドも使いません。',
    {
      role: 'Web で調べて、出典つきで要点をまとめる',
      expertise: 'Web 調査と情報の整理',
      permissions: allow('webSearch', 'webFetch', 'readFiles', 'skills'),
      unmentioned: 'ignore',
      consultable: true,
    },
  ),
  template('scribe', '書記', '議論をときどき要約して、決まったことと残った論点を書き残します。', {
    role: 'チャンネルの議論を定期的に要約し、決定事項と未解決の論点を残す',
    expertise: '議事の要約と記録',
    permissions: WORKSPACE_TOOLS,
    unmentioned: 'ignore',
    autonomyEnabled: true,
  }),
  template('critic', '批判役', '案の弱点やリスクを、あえて率直に指摘します。呼ばれたときだけ話します。', {
    role: '案の弱点・リスク・反対意見をあえて率直に出す',
    expertise: 'リスクの洗い出しと反論',
    permissions: allow('webSearch', 'readFiles', 'skills'),
    unmentioned: 'ignore',
    consultable: true,
  }),
  template(
    'enduser',
    'エンドユーザー役',
    '初めて使う人の目線で、感想と困りごとを伝えます。呼ばれたときだけ話します。',
    {
      role: '想定ユーザーとして、初めて見る立場で感想と困りごとを伝える',
      expertise: '初めて使う人の目線',
      permissions: allow('readFiles', 'skills'),
      unmentioned: 'ignore',
      consultable: true,
    },
  ),
];
