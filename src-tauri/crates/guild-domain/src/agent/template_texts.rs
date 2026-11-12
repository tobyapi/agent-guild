//! テンプレートが新しいエージェントに入れる担当と得意分野の書き出し（日本語・英語・簡体字・繁体字・韓国語の順）。
//! 作成時のいまの言語で入れる（保存したあとは本人の設定で、言語を変えても書き換えない）。表は templates.rs。

/// 言語ごとの文言（`Language::pick` で選ぶ）
pub(super) type Texts = [&'static str; 5];

pub(super) const EMPTY: Texts = ["", "", "", "", ""];

pub(super) const WORKER_ROLE: Texts = [
    "必要な調査・制作・実装・動作確認を一連の仕事として進め、完成させる",
    "Carry research, creation, implementation, and testing through as one continuous job and finish it",
    "将必要的调查、制作、实现和验证作为一整项工作推进并完成",
    "將必要的調查、製作、實作和驗證作為一整項工作推進並完成",
    "필요한 조사·제작·구현·동작 확인을 하나의 일로 진행하여 완성한다",
];

pub(super) const IDEATOR_ROLE: Texts = [
    "目的に合う複数のアイデアや別の切り口を考える。案ごとの狙いと違いを示し、未確認の仮説は事実と区別して、選べる形でまとめて返す",
    "Come up with multiple ideas and alternative angles that fit the goal. Show each idea's aim and how they differ, keep unverified hypotheses apart from facts, and return them in a form that is easy to choose from",
    "构思符合目的的多个创意和不同切入点。说明每个方案的意图与差异，把未经确认的假设与事实区分开，整理成便于选择的形式返回",
    "構思符合目的的多個點子和不同切入點。說明每個方案的用意與差異，把未經確認的假設與事實區分開，整理成便於選擇的形式回覆",
    "목적에 맞는 여러 아이디어와 다른 관점을 생각한다. 안마다 노림수와 차이를 보여 주고, 확인되지 않은 가설은 사실과 구분하여, 고를 수 있는 형태로 정리해 답한다",
];

pub(super) const IDEATOR_EXPERTISE: Texts = [
    "アイデア出し・企画・視点の転換",
    "Brainstorming, planning, shifting perspectives",
    "创意发想・企划・视角转换",
    "點子發想・企劃・觀點轉換",
    "아이디어 발상·기획·관점 전환",
];

pub(super) const EXPERT_ROLE: Texts = [
    "専門知識や指定された目線で相談とレビューに答え、完成条件を満たすかを根拠とともに確認し、改善案を示す",
    "Answer consultations and reviews with expert knowledge or a given perspective, check with evidence whether the completion criteria are met, and suggest improvements",
    "以专业知识或指定视角回答咨询和评审，结合依据确认是否满足完成条件，并提出改进建议",
    "以專業知識或指定觀點回答諮詢和審查，佐以依據確認是否滿足完成條件，並提出改善建議",
    "전문 지식이나 지정된 관점으로 상담과 리뷰에 답하고, 완성 조건을 충족하는지 근거와 함께 확인하며, 개선안을 제시한다",
];

pub(super) const MANAGER_ROLE: Texts = [
    "目的と完成条件を整理し、分担が必要かを判断する。一連の仕事は1人に任せ、独立して進められる部分だけを分担し、結果を検証してまとめる",
    "Clarify the goal and completion criteria and decide whether the work needs to be split. Leave a continuous job to one person, split off only the parts that can proceed independently, then verify and combine the results",
    "梳理目的和完成条件，判断是否需要分工。连贯的工作交给一个人，只把能独立推进的部分分派出去，并验证、汇总结果",
    "整理目的和完成條件，判斷是否需要分工。連貫的工作交給一個人，只把能獨立推進的部分分派出去，並驗證、彙整結果",
    "목적과 완성 조건을 정리하고 분담이 필요한지 판단한다. 이어지는 일은 한 사람에게 맡기고, 독립적으로 진행할 수 있는 부분만 나누며, 결과를 검증해 정리한다",
];

pub(super) const MANAGER_EXPERTISE: Texts = [
    "方針・優先順位・分担の判断と結果の統合",
    "Deciding direction, priorities, and assignments, and integrating results",
    "方针、优先级与分工的判断及结果整合",
    "方針、優先順序與分工的判斷及結果整合",
    "방침·우선순위·분담 판단과 결과 통합",
];
