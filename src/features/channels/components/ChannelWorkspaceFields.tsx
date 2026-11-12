import { useBackends } from '@/features/runtime';
import type { WorkspaceMode } from '@/shared/types/domain';
import { Button, SelectField, TextField, reportError } from '@/shared/ui';
import { channelsApi } from '../api';
import type { useChannelForm } from '../hooks/useChannelForm';
import { folderScopeHint } from '../model/channels';

/** チャンネルの作業範囲（エージェント共通・指定フォルダ・チャンネル専用）を選ぶ欄 */
export function ChannelWorkspaceFields({ form }: { form: ReturnType<typeof useChannelForm> }) {
  const backends = useBackends();
  return (
    <>
      <SelectField
        label="ファイルの範囲"
        value={form.draft.workspaceMode}
        onChange={(value) => form.update('workspaceMode', value as WorkspaceMode)}
      >
        <option value="shared">エージェント共通の作業場所（役割の権限）</option>
        <option value="folder">指定した作業フォルダ</option>
        <option value="global">チャンネル専用の作業場所（役割の権限）</option>
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
          value={form.draft.workspaceFolder}
          onChange={(value) => form.update('workspaceFolder', value)}
          onBlur={() => form.touch('workspaceFolder')}
          error={form.errors.workspaceFolder}
          placeholder="フォルダの絶対パス"
          hint={folderScopeHint(backends)}
        />
      )}
      {form.draft.workspaceMode === 'global' && (
        <p>作業場所とメモをこのチャンネルだけで使います。PC 全体へのアクセスは、役割とバックエンドに従います。</p>
      )}
    </>
  );
}
