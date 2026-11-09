// Codex SDK のアダプタ。人格は config の developer_instructions で渡し、権限は sandbox・ネットワーク・Web 検索の設定に写す。
// スキルは Codex が読む作業場所の .agents/skills に実行のたびに作り直す（エージェント単位の排他は Rust が保証する）。

import { join } from 'node:path';
import { Codex } from '@openai/codex-sdk';
import { errorMessage } from '../log.ts';
import { codexError, readEvent } from './codex/events.ts';
import {
  codexConfig,
  MAX_SYSTEM_PROMPT_LENGTH,
  PERMISSION_RULES,
  REASONING_EFFORTS,
  threadInput,
  threadOptions,
  unenforceableReason,
} from './codex/options.ts';
import { probeCodex } from './codex/probe.ts';
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
  modelSuggestions: [],
  defaultModel: '',
  capabilities: { webSearch: true, webFetch: true, readFiles: true, writeFiles: true, writeAnywhere: true, runCommands: true, skills: true },
  options: [
    {
      key: 'reasoningEffort',
      label: '推論の深さ',
      description: '深いほど時間をかけて考える',
      type: 'select',
      choices: [...REASONING_EFFORTS],
      default: 'medium',
    },
  ],
  permissionRules: [...PERMISSION_RULES],
  canLogin: false,
};

async function run(request: RunRequest, { signal, onActivity }: RunContext): Promise<string> {
  rejectUnenforceable('Codex', unenforceableReason(request.permissions));
  if (request.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new BackendError('bad_request', `Codex に渡すシステムプロンプトは ${MAX_SYSTEM_PROMPT_LENGTH} 文字までです`);
  }
  try {
    await writeSkills(join(request.workspace, '.agents', 'skills'), request.skills);
    const thread = new Codex({ config: codexConfig(request) }).startThread(threadOptions(request));
    const { events } = await thread.runStreamed(threadInput(request), { signal });
    let text = '';
    for await (const event of events) text = readEvent(event, onActivity) ?? text;
    return text;
  } catch (error) {
    if (error instanceof BackendError || signal.aborted) throw error;
    throw codexError(errorMessage(error));
  }
}

export const codexAdapter: BackendAdapter = {
  info: () => INFO,
  probe: probeCodex,
  run,
};
