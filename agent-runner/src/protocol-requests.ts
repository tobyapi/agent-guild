import type { ApprovalResponse } from './protocol-approval.ts';
import type { ImagePayload, SkillPayload } from './protocol-payloads.ts';
import type { Language, Permissions } from './protocol.ts';

export const RUN_TIMEOUT_MINUTES = [30, 60, 120] as const;

/** Rust → runner */
export type RunnerRequest =
  | ApprovalResponse
  | { type: 'theme'; id: string; backend: string; subject: string }
  | { type: 'background'; id: string; backend: string; prompt: string }
  | { type: 'backgroundCancel'; id: string }
  | {
      type: 'run';
      id: string;
      backend: string;
      /** エージェントの作業場所（cwd。絶対パス）。書き込みはここだけ */
      workspace: string;
      /** アダプタの管理領域（スキルの展開・人格ファイル・SDK 設定など）。エージェントからは書けない */
      stateDir: string;
      /** 作業場所を作り、管理領域を実行前に作り直す。アプリが管理するパスにだけ指定する */
      prepareWorkspace?: boolean;
      /** 承認待ちを除く実行時間の上限（分）。省略時は制限なし */
      timeoutMinutes?: (typeof RUN_TIMEOUT_MINUTES)[number];
      /** 追加で読み取りを許すフォルダ（相談元の作業場所など） */
      readableDirs: string[];
      systemPrompt: string;
      prompt: string;
      /** 操作の確認に使う、信頼できる依頼の情報（人間の依頼・エージェントの役割とできること。資料や仲間の発言は入らない） */
      intent: string;
      /** 空文字ならバックエンド既定 */
      model: string;
      permissions: Permissions;
      /** SDK ごとの置き場所への展開はアダプタの責務 */
      skills: SkillPayload[];
      /** 応える発言と会話の起点に貼られた画像（発言の順）。なければ空 */
      images: ImagePayload[];
      /** Agent.backendOptions。知らないキーは無視する。EFFORT_OPTION（effort）は推論の深さ */
      options: Record<string, unknown>;
    }
  /**
   * 画像を1枚描く（BackendInfo.frameGeneration を申告したアダプタだけ。ほかは error{bad_request}）。権限は持たない:
   * アダプタは画像を生成する道具と、添えたスキルの手順に要る道具（作業場所の中だけに書けるコマンド・画像を見る道具）だけを
   * 使わせる（ネットワーク・Web なし）。始める前に output の前の残りを消し、終わったときに output に PNG がなければ生成した
   * 画像を書いてから result（text は空）で終える。画像ができなかったら error（理由はいまの言語）。cancel で打ち切れる
   */
  | {
      type: 'image';
      id: string;
      backend: string;
      /** cwd（絶対パス。書き込みはここだけ） */
      workspace: string;
      /** アダプタの管理領域 */
      stateDir: string;
      /** 空なら足さない */
      systemPrompt: string;
      prompt: string;
      /** 描くときに従うスキル（run の skills と同じ形と展開。枠の生成では内蔵スキル ornate-avatar-frame。なければ []） */
      skills: SkillPayload[];
      /** 出来上がった PNG の絶対パス（Rust が決める。作業場所の中に置き、プロンプトで保存先として伝える） */
      output: string;
    }
  | { type: 'cancel'; id: string }
  /** バックエンドの状態（認証など）を確認し直して backends を送る */
  | { type: 'apiKey'; id: string; backend: string; action: 'status' | 'set' | 'delete'; key?: string }
  | { type: 'backendAuthMode'; id: string; backend: string; mode: 'desktop' | 'api' }
  | { type: 'probe'; id: string }
  /** ログインを始める（setup.login のあるものだけ）。終わったら backends を送り、result（text は空）か error で終える。cancel で打ち切れる */
  | { type: 'login'; id: string; backend: string }
  /** ランナーが作る文字列（BackendInfo の説明・途中経過・エラー）の言語を変え、backends を送り直す。id も返事もない */
  | { type: 'setLanguage'; language: Language }
  | { type: 'shutdown' };
