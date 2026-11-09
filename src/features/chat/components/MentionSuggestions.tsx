import { Fragment } from 'react';
import { PrimaryTagBadge } from '@/features/agents';
import { BackendTag, useBackend } from '@/features/runtime';
import { Avatar } from '@/shared/ui';
import { highlightParts } from '../model/mentionQuery';
import type { MentionOption } from '../model/mentionQuery';
import styles from './MentionSuggestions.module.css';

export interface MentionSuggestionsProps {
  /** listbox の id（入力欄の aria-controls から指す）。各候補の id は `${id}-${index}` */
  id: string;
  query: string;
  options: readonly MentionOption[];
  activeIndex: number;
  onPick: (option: MentionOption) => void;
  onHover: (index: number) => void;
}

/** メンション補完のポップオーバー（入力欄の上。docs/ui-design.md §5.6） */
export function MentionSuggestions({ id, query, options, activeIndex, onPick, onHover }: MentionSuggestionsProps) {
  const firstOutsider = options.findIndex((option) => !option.isMember);
  return (
    <div className={styles.popover}>
      <p className={styles.heading}>呼びかける相手</p>
      {options.length === 0 ? (
        <p className={styles.empty}>{query ? `『${query}』に一致するエージェントはいません` : 'エージェントはまだいません'}</p>
      ) : (
        <ul id={id} role="listbox" aria-label="呼びかける相手" className={styles.list}>
          {options.map((option, index) => (
            <Fragment key={option.agent.id}>
              {index === firstOutsider && (
                <li role="presentation" className={styles.separator}>
                  チャンネル外 — 呼ぶと参加します
                </li>
              )}
              <Suggestion
                id={`${id}-${index}`}
                option={option}
                query={query}
                active={index === activeIndex}
                onPick={() => onPick(option)}
                onHover={() => onHover(index)}
              />
            </Fragment>
          ))}
        </ul>
      )}
      <p className={styles.hints}>
        <kbd>↑</kbd>
        <kbd>↓</kbd> 選ぶ · <kbd>Enter</kbd> 決定 · <kbd>Esc</kbd> 閉じる
      </p>
    </div>
  );
}

interface SuggestionProps {
  id: string;
  option: MentionOption;
  query: string;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}

/**
 * 候補の行。マウスは動かしたときだけ選択を移す（onMouseEnter だと、開いた一覧やスクロールで止まっているマウスの
 * 下に来た候補にも選択が移り、キーボードで選んだ相手が奪われる。スクロールでは mousemove は起きない）
 */
function Suggestion({ id, option, query, active, onPick, onHover }: SuggestionProps) {
  const { agent } = option;
  const backend = useBackend(agent.backend);
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      className={styles.option}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      onMouseMove={active ? undefined : onHover}
    >
      <Avatar avatar={agent.avatar} name={agent.name} color={agent.color} size="xs" />
      <span className={styles.name}>
        {highlightParts(option.name, query).map((part, index) =>
          part.match ? <mark key={index}>{part.text}</mark> : <Fragment key={index}>{part.text}</Fragment>,
        )}
      </span>
      <PrimaryTagBadge tags={agent.tags} />
      {backend && backend.status !== 'ready' && <BackendTag backendId={agent.backend} />}
      <span className={styles.role}>{agent.role}</span>
    </li>
  );
}
