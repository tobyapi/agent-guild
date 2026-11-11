import { Button, SelectField, TextField, reportError } from '@/shared/ui';
import { channelsApi } from '../api';
import type { useChannelForm } from '../hooks/useChannelForm';

export function ChannelWorkspaceFields({ form }: { form: ReturnType<typeof useChannelForm> }) {
  return (
    <>
      <SelectField
        label="ファイルの範囲"
        value={form.draft.workspaceMode ?? 'legacy'}
        onChange={(value) => form.update('workspaceMode', value as 'legacy' | 'folder' | 'global')}
      >
        <option value="legacy">今までどおり（役割の権限）</option>
        <option value="folder">指定した作業フォルダ</option>
        <option value="global">PC全体（役割の権限）</option>
      </SelectField>
      {form.draft.workspaceMode === 'folder' && (
        <TextField
          label="作業フォルダ"
          labelAction={
            <Button
              type="button"
              onClick={() => {
                void channelsApi.chooseFolder().then((path) => {
                  if (path) form.update('workspaceFolder', path);
                }, reportError);
              }}
            >
              フォルダを選ぶ
            </Button>
          }
          value={form.draft.workspaceFolder ?? ''}
          onChange={(value) => form.update('workspaceFolder', value)}
          onBlur={() => form.touch('workspaceFolder')}
          error={form.errors.workspaceFolder}
          placeholder="フォルダの絶対パス"
          hint="同じフォルダを複数チャンネルで共有できます。範囲変更後は過去の会話・メモをAIへ自動投入しません。Ollamaはファイル操作を利用できます（macOSか、OSの隔離が使えるWindows 11。コマンドは使えません）。Codex・Grok・Museは、OSの隔離が使えるWindows 11で、コマンドも範囲の中で利用できます。スキルは使えません。Claudeは範囲を制限できないため実行を停止します。"
        />
      )}
      {form.draft.workspaceMode === 'global' && (
        <p>
          PC全体へのアクセスは役割とバックエンドに従います。Claudeの拡張読み取りには秘密の場所の除外が適用されます。
        </p>
      )}
    </>
  );
}
