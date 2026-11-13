import { useBackends } from '@/features/runtime';
import type { WorkspaceMode } from '@/shared/types/domain';
import { Button, SelectField, TextField, reportError } from '@/shared/ui';
import { channelsApi } from '../api';
import type { useChannelForm } from '../hooks/useChannelForm';
import { folderScopeHint } from '../model/channels';
import { t } from '../i18n';

/** チャンネルの作業範囲（エージェントごと（全チャンネル共通）・指定フォルダ・チャンネル専用）を選ぶ欄 */
export function ChannelWorkspaceFields({ form }: { form: ReturnType<typeof useChannelForm> }) {
  const backends = useBackends();
  return (
    <>
      <SelectField
        label={t('fileScope')}
        value={form.draft.workspaceMode}
        onChange={(value) => form.update('workspaceMode', value as WorkspaceMode)}
      >
        <option value="shared">{t('scopeShared')}</option>
        <option value="folder">{t('scopeFolder')}</option>
        <option value="global">{t('scopeGlobal')}</option>
      </SelectField>
      {form.draft.workspaceMode === 'folder' && (
        <TextField
          label={t('folderLabel')}
          labelAction={
            <Button
              type="button"
              onClick={() => {
                void channelsApi.chooseFolder().then((path) => {
                  if (path) form.update('workspaceFolder', path);
                }, reportError);
              }}
            >
              {t('chooseFolder')}
            </Button>
          }
          value={form.draft.workspaceFolder}
          onChange={(value) => form.update('workspaceFolder', value)}
          onBlur={() => form.touch('workspaceFolder')}
          error={form.errors.workspaceFolder}
          placeholder={t('folderPlaceholder')}
          hint={folderScopeHint(backends)}
        />
      )}
      {form.draft.workspaceMode === 'global' && <p>{t('globalNote')}</p>}
    </>
  );
}
