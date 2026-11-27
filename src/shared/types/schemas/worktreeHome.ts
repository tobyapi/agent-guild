// git worktree の置き場のスキーマ（get_worktree_home の戻り値と contracts/ipc/worktree-home.json）
import type { WorktreeHome } from '../domain';
import { nullable, string } from '../schema';
import type { Schema } from '../schema';

export const worktreeHomeSchema = { path: nullable(string), defaultPath: string } satisfies Schema<WorktreeHome>;
