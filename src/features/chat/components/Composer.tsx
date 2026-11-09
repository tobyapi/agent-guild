import { useMemo, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useActiveAgents } from '@/features/agents';
import { useRuntimeStatus } from '@/features/runtime';
import { Icon, IconButton } from '@/shared/ui';
import type { Channel } from '@/shared/types/domain';
import { useComposer } from '../hooks/useComposer';
import { useComposerAttachments } from '../hooks/useComposerAttachments';
import { buildMentionOptions } from '../model/mentionQuery';
import { MentionSuggestions } from './MentionSuggestions';
import { PendingAttachments } from './PendingAttachments';
import styles from './Composer.module.css';

/** 入力欄（docs/ui-design.md §5.6）。チャンネルを替えたら作り直す（key に channel.id） */
export function Composer({ channel }: { channel: Channel }) {
  const agents = useActiveAgents();
  const runtime = useRuntimeStatus();
  const candidates = useMemo(() => buildMentionOptions(agents, channel.memberIds), [agents, channel.memberIds]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const files = useComposerAttachments();
  const composer = useComposer(channel.id, candidates, textareaRef, files);
  const { completion, listId } = composer;
  const hasOptions = completion.open && completion.matches.length > 0;
  const canSend = composer.text.trim() !== '' || files.attachments.length > 0;
  const placeholder =
    runtime.state === 'unavailable'
      ? 'いまはエージェントが返答できません（実行環境が止まっています）'
      : `#${channel.name} へメッセージ（@ で呼びかけ・ファイルはドロップで添付）`;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    composer.submit();
  };

  return (
    <form
      className={styles.composer}
      data-dragging={files.dragging ? '' : undefined}
      onSubmit={onSubmit}
      onDragOver={files.onDragOver}
      onDragLeave={files.onDragLeave}
      onDrop={files.onDrop}
    >
      {completion.open && (
        <MentionSuggestions
          id={listId}
          query={completion.query?.query ?? ''}
          options={completion.matches}
          activeIndex={completion.activeIndex}
          onPick={composer.pick}
          onHover={completion.select}
        />
      )}
      <PendingAttachments attachments={files.attachments} onRemove={files.remove} />
      <AttachButton onFiles={files.add} />
      <textarea
        ref={textareaRef}
        className={styles.input}
        value={composer.text}
        onChange={composer.onChange}
        onKeyDown={composer.onKeyDown}
        onSelect={composer.onSelect}
        onPaste={files.onPaste}
        onBlur={completion.close}
        placeholder={placeholder}
        rows={1}
        aria-label={`#${channel.name} へのメッセージ`}
        aria-autocomplete="list"
        aria-controls={hasOptions ? listId : undefined}
        aria-activedescendant={hasOptions ? `${listId}-${completion.activeIndex}` : undefined}
      />
      <button
        type="submit"
        className={styles.send}
        data-ready={canSend ? '' : undefined}
        disabled={!canSend}
        aria-label="送信"
        title="送信 Enter · 改行 Shift+Enter"
      >
        <Icon name="send" />
      </button>
    </form>
  );
}

/** ファイルを選んで添付する（ドロップ・貼り付けでも添付できる） */
function AttachButton({ onFiles }: { onFiles: (files: readonly File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []));
    // 同じファイルをもう一度選べるように空にする
    event.target.value = '';
  };
  return (
    <>
      <IconButton
        label="ファイルを添付（ドロップ・貼り付けでも添付できます）"
        className={styles.attach}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="paperclip" />
      </IconButton>
      <input ref={inputRef} type="file" multiple hidden onChange={onChange} />
    </>
  );
}
