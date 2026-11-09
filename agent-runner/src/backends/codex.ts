// Codex SDK のアダプタ。人格は config の developer_instructions で渡し、権限は sandbox・ネットワーク・Web 検索の設定に写す。
// スキルは Codex が読む作業場所の .agents/skills に実行のたびに作り直す（エージェント単位の排他は Rust が保証する）。
// Codex CLI は利用者の環境に入っているものを使う（codex/executable.ts）。

import { join } from 'node:path';
import { Codex } from '@openai/codex-sdk';
import { errorMessage } from '../log.ts';
import { codexError, EventReader } from './codex/events.ts';
import { CODEX_NOT_FOUND, findCodex } from './codex/executable.ts';
import { codexCatalog } from './codex/models.ts';
import {
  codexConfig,
  LEAK_RISKS,
  MAX_SYSTEM_PROMPT_LENGTH,
  PERMISSION_RULES,
  threadInput,
  threadOptions,
  unenforceableReason,
} from './codex/options.ts';
import { probeCodex } from './codex/probe.ts';
import { withPathDirs } from './executables.ts';
import { writeSkills } from './skill-files.ts';
import {
  BackendError,
  rejectUnenforceable,
  type BackendAdapter,
  type BackendDescriptor,
  type RunContext,
  type RunRequest,
} from './types.ts';

const INFO: BackendDescriptor = {
  id: 'codex',
  label: 'Codex',
  capabilities: { webSearch: true, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: true, runCommands: true, skills: true },
  // 推論の深さはモデルごとに選ぶ（models.ts の一覧。backendOptions の effort）
  options: [],
  permissionRules: [...PERMISSION_RULES],
  leakRisks: LEAK_RISKS.map((risk) => [...risk]),
  canLogin: false,
  midRunPost: 'text',
};

async function run(request: RunRequest, { signal, onActivity, onPost }: RunContext): Promise<string> {
  rejectUnenforceable('Codex', unenforceableReason(request.permissions));
  if (request.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new BackendError('bad_request', `Codex に渡すシステムプロンプトは ${MAX_SYSTEM_PROMPT_LENGTH} 文字までです`);
  }
  const executable = findCodex();
  if (executable === null) throw new BackendError('internal', CODEX_NOT_FOUND);
  try {
    await writeSkills(join(request.workspace, '.agents', 'skills'), request.skills);
    const codex = new Codex({
      config: codexConfig(request),
      codexPathOverride: executable.path,
      env: withPathDirs(executable.pathDirs),
    });
    const thread = codex.startThread(threadOptions(request, codexCatalog()));
    const { events } = await thread.runStreamed(threadInput(request), { signal });
    const reader = new EventReader(onActivity, onPost);
    for await (const event of events) reader.read(event);
    return reader.finalText;
  } catch (error) {
    if (error instanceof BackendError || signal.aborted) throw error;
    throw codexError(errorMessage(error));
  }
}

export const codexAdapter: BackendAdapter = {
  info: () => INFO,
  probe: probeCodex,
  catalog: () => Promise.resolve(codexCatalog()),
  run,
};
