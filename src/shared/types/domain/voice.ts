/** 文体の選択。auto は返答ごとの判断、off は基本の口調。 */
export interface VoiceSettings {
  mode: string;
  intensity: 'weak' | 'medium' | 'strong';
}
