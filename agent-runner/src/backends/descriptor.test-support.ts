// テストで使うバックエンドの申告のうち、バックエンドごとの違いが何もない形
// （指定フォルダでは実行できない・道具は役割どおり・API を使う・枠は生成しない・セットアップなし）。必要な項目だけを上書きして使う。
import { NO_SETUP, type BackendDescriptor } from './types.ts';

export const PLAIN: Pick<BackendDescriptor, 'folderScope' | 'toolsOption' | 'local' | 'frameGeneration' | 'setup'> = {
  folderScope: null,
  toolsOption: null,
  local: false,
  frameGeneration: false,
  setup: NO_SETUP,
};
