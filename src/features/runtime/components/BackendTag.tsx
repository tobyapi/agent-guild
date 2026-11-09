import { Tag } from '@/shared/ui';
import { useBackend } from '../hooks/useRuntime';
import { BACKEND_STATUS_TONES, BACKEND_STATUS_WORDS, backendTitle } from '../model/status';
import styles from './BackendTag.module.css';

export interface BackendTagProps {
  backendId: string;
  /**
   * 準備ができていないときに状態（色と言葉）を出す（既定は出す）。発言の見出しでは出さない:
   * 書いた時点の状態ではなく、過去の発言すべてに札が並んでしまうため（docs/ui-design.md §5.4）
   */
  showStatus?: boolean;
}

/**
 * バックエンドの線の札（色なし・等幅の id）。準備ができていなければ状態の言葉を続ける（docs/ui-design.md §6.2）。
 * 表示名と案内はツールチップに出す。
 */
export function BackendTag({ backendId, showStatus = true }: BackendTagProps) {
  const backend = useBackend(backendId);
  if (!backend) return <Tag title="この環境では見つからないバックエンドです">{backendId}</Tag>;
  if (!showStatus) return <Tag title={backend.label}>{backend.id}</Tag>;
  return (
    <Tag tone={BACKEND_STATUS_TONES[backend.status]} title={backendTitle(backend)}>
      {backend.id}
      {backend.status !== 'ready' && <span className={styles.word}>· {BACKEND_STATUS_WORDS[backend.status]}</span>}
    </Tag>
  );
}
