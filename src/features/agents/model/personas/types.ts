// 性格・話し方のプリセット（docs/persona-presets.md）。UI だけのデータで、選ぶと入力欄に text が入る。

/** 一覧を見出しで分ける組。定番は組なし（undefined）で、一覧の先頭に見出しなしで並ぶ */
export type PresetGroup = 'character';

export interface PersonaPreset {
  /** 英小文字とハイフン。一度出したら変えない */
  id: string;
  label: string;
  /** そのままシステムプロンプトに入る文面 */
  text: string;
  /** 一覧で見出しを付けて分ける組（定番はなし）。同じ組は続けて並べる */
  group?: PresetGroup;
}

export interface TonePreset extends PersonaPreset {
  /** 選ぶ前に雰囲気を見せる見本の一文（プロンプトには入れない） */
  sample: string;
}

/** 性格（sample なし）と話し方（sample あり）を同じに扱うとき */
export type AnyPreset = PersonaPreset & { sample?: string };
