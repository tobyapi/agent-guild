// システム発言と注記の文面（言語ごと）。Rust の guild-domain（conversation/notices.rs と delegation/verdict.rs の
// SubtaskNote）と同じ文面で、contracts/behavior/notices.json で両方を検査する。文面を変えるときは、Rust・実例・ここを同じ変更で直す。
// 言語は呼んだ時点のいまの言語（作った時点の言語で保存し、あとで言語を変えても書き換えない）。
import { currentLanguage } from '@/shared/i18n';
import type { Language } from '@/shared/types/domain';
import { MAX_SUBTASKS } from './delegation/tasks';

type Texts = Readonly<Record<Language, string>>;

const SEPARATORS: Texts = { ja: '・', en: ', ', 'zh-Hans': '、', 'zh-Hant': '、', ko: ', ' };

const list = (names: readonly string[], language: Language) => names.join(SEPARATORS[language]);

/** 停止したとき */
export const stopped = (language = currentLanguage()) =>
  ({ ja: '停止しました', en: 'Stopped.', 'zh-Hans': '已停止。', 'zh-Hant': '已停止。', ko: '중지했습니다.' })[language];

/** AI 同士の往復が上限に達して振り分けを止めたとき（起点ごとに1回） */
export const depthLimit = (language = currentLanguage()) =>
  ({
    ja: 'AI 同士の往復が上限に達したので止めました。続けるにはメンションしてください。',
    en: 'Stopped because the back-and-forth between AIs reached its limit. Mention someone to continue.',
    'zh-Hans': 'AI 之间的往返次数已达上限，已停止。如需继续，请提及成员。',
    'zh-Hant': 'AI 之間的往返次數已達上限，已停止。如需繼續，請提及成員。',
    ko: 'AI 간 대화가 한도에 도달하여 멈췄습니다. 계속하려면 멘션하세요.',
  })[language];

/** メンションなしの人間の発言に答えられるエージェントがいないとき */
export const noResponder = (language = currentLanguage()) =>
  ({
    ja: 'いま返答できるエージェントがいません（バックエンドの準備ができていないか、答える設定のメンバーがいません）',
    en: "No agent can reply right now (the backend isn't ready, or no member is set to answer).",
    'zh-Hans': '目前没有可以回复的智能体（后端尚未就绪，或没有设置为回答的成员）。',
    'zh-Hant': '目前沒有可以回覆的代理人（後端尚未就緒，或沒有設定為回答的成員）。',
    ko: '지금 답할 수 있는 에이전트가 없습니다(백엔드가 준비되지 않았거나, 답하도록 설정된 멤버가 없습니다).',
  })[language];

/** ジョブが時間切れになったとき */
export const timedOut = (language = currentLanguage()) =>
  ({
    ja: '時間切れで中断しました（15分）',
    en: 'Stopped because it took too long (15 minutes).',
    'zh-Hans': '已超时中断（15 分钟）。',
    'zh-Hant': '已逾時中斷（15 分鐘）。',
    ko: '시간이 초과되어 중단했습니다(15분).',
  })[language];

/** チャンネル外のエージェントが呼ばれて自動で参加したとき */
export const joined = (name: string, language = currentLanguage()) =>
  ({
    ja: `${name} がチャンネルに参加しました`,
    en: `${name} joined the channel.`,
    'zh-Hans': `${name} 加入了频道。`,
    'zh-Hant': `${name} 加入了頻道。`,
    ko: `${name} 님이 채널에 참여했습니다.`,
  })[language];

/** メンションされた相手がチャンネルにおらず、自動参加もしないとき */
export const undeliverable = (name: string, language = currentLanguage()) =>
  ({
    ja: `${name} はこのチャンネルにいないため、メッセージは届きませんでした`,
    en: `${name} is not in this channel, so the message was not delivered.`,
    'zh-Hans': `${name} 不在此频道中，消息未送达。`,
    'zh-Hant': `${name} 不在此頻道中，訊息未送達。`,
    ko: `${name} 님은 이 채널에 없어서 메시지가 전달되지 않았습니다.`,
  })[language];

/** 相談相手が [PASS] や空の返答で終わったときの注記 */
export const didNotAnswer = (name: string, language = currentLanguage()) =>
  ({
    ja: `${name} は回答しませんでした`,
    en: `${name} did not answer.`,
    'zh-Hans': `${name} 没有回答。`,
    'zh-Hant': `${name} 沒有回答。`,
    ko: `${name} 님은 답하지 않았습니다.`,
  })[language];

/** 相談相手の実行が失敗したときの注記 */
export const failed = (name: string, language = currentLanguage()) =>
  ({
    ja: `${name} は失敗しました`,
    en: `${name} failed.`,
    'zh-Hans': `${name} 执行失败。`,
    'zh-Hant': `${name} 執行失敗。`,
    ko: `${name} 님은 실패했습니다.`,
  })[language];

/** tasks ブロックに割り振れない名前があったとき */
export const unassignable = (names: readonly string[], language = currentLanguage()) => {
  const all = list(names, language);
  return {
    ja: `${all} には割り振れませんでした（見つからないか、自分自身です）`,
    en: `Could not delegate to ${all} (not found, or it is yourself).`,
    'zh-Hans': `无法分派给 ${all}（找不到，或是自己）。`,
    'zh-Hant': `無法分派給 ${all}（找不到，或是自己）。`,
    ko: `${all} 님에게는 위임할 수 없었습니다(찾을 수 없거나 자기 자신입니다).`,
  }[language];
};

/** サブタスクが上限を超えたとき */
export const tooManyTasks = (names: readonly string[], language = currentLanguage()) => {
  const all = list(names, language);
  const max = MAX_SUBTASKS;
  return {
    ja: `サブタスクは${max}件までです。${all} への割り振りは飛ばしました`,
    en: `Up to ${max} subtasks are allowed. Skipped delegating to ${all}.`,
    'zh-Hans': `子任务最多 ${max} 个。已跳过对 ${all} 的分派。`,
    'zh-Hant': `子任務最多 ${max} 個。已略過對 ${all} 的分派。`,
    ko: `하위 작업은 ${max}개까지입니다. ${all} 님에 대한 위임은 건너뛰었습니다.`,
  }[language];
};

/** 前回アプリが終了したときに返答が中断されたとき（モックでは使わないが、文面は Rust と合わせておく） */
export const interrupted = (names: readonly string[], language = currentLanguage()) => {
  const all = list(names, language);
  return {
    ja: `前回アプリが終了したときに、${all}の返答が中断されました。続けるには、もう一度話しかけてください。`,
    en: `The reply from ${all} was interrupted when the app last closed. Send a message again to continue.`,
    'zh-Hans': `上次关闭应用时，${all} 的回复被中断了。如需继续，请再发一次消息。`,
    'zh-Hant': `上次關閉應用程式時，${all} 的回覆被中斷了。如需繼續，請再傳一次訊息。`,
    ko: `지난번 앱이 종료될 때 ${all} 님의 답변이 중단되었습니다. 계속하려면 다시 말을 걸어 주세요.`,
  }[language];
};

const SUBTASK_NOTES = {
  noAnswer: {
    ja: '回答がありませんでした',
    en: 'No answer.',
    'zh-Hans': '没有回答。',
    'zh-Hant': '沒有回答。',
    ko: '답변이 없었습니다.',
  },
  runFailed: {
    ja: '失敗しました',
    en: 'Failed.',
    'zh-Hans': '执行失败。',
    'zh-Hant': '執行失敗。',
    ko: '실패했습니다.',
  },
  timedOut: {
    ja: '時間切れで中断しました',
    en: 'Timed out.',
    'zh-Hans': '已超时中断。',
    'zh-Hant': '已逾時中斷。',
    ko: '시간이 초과되어 중단했습니다.',
  },
  assigneeRemoved: {
    ja: '担当者が外れました',
    en: 'The assignee was removed.',
    'zh-Hans': '负责人已被移除。',
    'zh-Hant': '負責人已被移除。',
    ko: '담당자가 빠졌습니다.',
  },
  notStarted: {
    ja: '実行されませんでした',
    en: 'Never ran.',
    'zh-Hans': '未执行。',
    'zh-Hant': '未執行。',
    ko: '실행되지 않았습니다.',
  },
} as const satisfies Record<string, Texts>;

export type SubtaskNote = keyof typeof SUBTASK_NOTES;

/** サブタスクが失敗で決着したときの理由 */
export const subtaskNote = (note: SubtaskNote, language = currentLanguage()) => SUBTASK_NOTES[note][language];
