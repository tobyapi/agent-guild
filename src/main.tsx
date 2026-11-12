import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// トークン → 土台の順に1回ずつ読み込む（tokens.css が寸法とライトテーマ、global.css が操作の手ざわりと動きを読み込む）
import '@/shared/ui/theme/tokens.css';
import '@/shared/ui/theme/global.css';
import { App } from '@/app/App';
import { initTheme } from '@/features/settings';
import { initLanguage } from '@/shared/i18n';

// 最初の描画の前に、保存されていたテーマ（<html data-theme>）を反映する
initTheme();
initLanguage();

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
