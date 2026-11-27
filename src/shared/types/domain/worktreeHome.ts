/** git worktree（作業用フォルダ）の置き場。Rust の guild_domain::worktree_home::WorktreeHome */
export interface WorktreeHome {
  /** 利用者が設定した置き場（絶対パス）。null なら既定 */
  path: string | null;
  /** 既定の置き場（<データフォルダ>/worktrees） */
  defaultPath: string;
}
