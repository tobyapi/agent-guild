import { RecoveryScreen } from '@/features/recovery';
import { ToastViewport } from '@/shared/ui';
import { AppShell } from './AppShell';
import { StartupScreen } from './StartupScreen';
import { useBootstrap } from './useBootstrap';

/** アプリの入口: 起動処理の結果に応じて、起動中・復旧画面・本体・起動失敗を出し分ける */
export function App() {
  const { state, retry } = useBootstrap();
  return (
    <>
      {state.phase === 'ready' && <AppShell />}
      {state.phase === 'recovery' && <RecoveryScreen boot={state.boot} />}
      {state.phase === 'loading' && <StartupScreen />}
      {state.phase === 'failed' && <StartupScreen error={state.message} onRetry={retry} />}
      <ToastViewport />
    </>
  );
}
