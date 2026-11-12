import { LANGUAGES, parseLanguage, useLanguage } from '@/shared/i18n';
import { SelectField } from '@/shared/ui';
import { t } from '../i18n';
import { changeLanguage } from '../store';

/** 表示と会話の言語（設定ダイアログと初回起動の初期設定）。選ぶとすぐ画面が切り替わり、settings.json に保存する */
export function LanguageSection() {
  const language = useLanguage();
  const select = (value: string) => {
    const next = parseLanguage(value);
    if (next !== null) changeLanguage(next);
  };
  return (
    <SelectField label={t('languageLabel')} hint={t('languageHint')} value={language} onChange={select}>
      {LANGUAGES.map((option) => (
        <option key={option.value} value={option.value} lang={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}
