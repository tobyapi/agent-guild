// Codex で画像を1枚描く（image 要求。アイコンの枠の生成）。道具は画像の生成とスキルの手順に要るものに絞り
// （./image-options.ts）、添えたスキルは run と同じく作業場所に置いて、依頼の中の呼び出しをその SKILL.md へのリンクにする
// （./skills.ts）。request.output（作業場所の中。依頼で保存先として伝える）の前の残りは始める前に消し、終わったときに
// Codex がそこへ PNG を保存していなければ、このスレッドが生成した最後の PNG（./generated-images.ts）を写す。

import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Codex } from '@openai/codex-sdk';
import { errorMessage } from '../../log.ts';
import { withPathDirs } from '../executables.ts';
import { BackendError, type ImageContext, type ImageRequest } from '../types.ts';
import { codexError, EventReader } from './events.ts';
import { codexNotFound, findCodex } from './executable.ts';
import { generatedImagesDir, isPngFile, newestPng } from './generated-images.ts';
import { imageConfig, imageThreadOptions } from './image-options.ts';
import { codexCatalog, codexHome } from './models.ts';
import { installCodexSkills, referSkills } from './skills.ts';
import { MAX_SYSTEM_PROMPT_LENGTH } from './options.ts';
import { t } from './texts/index.ts';

/** 失敗の文面に添える Codex の返事の長さ */
const REPLY_PREVIEW_CHARS = 200;

export async function generateCodexImage(request: ImageRequest, { signal, onActivity }: ImageContext): Promise<void> {
  if (request.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    throw new BackendError('bad_request', t('systemPromptTooLong', { max: MAX_SYSTEM_PROMPT_LENGTH }));
  }
  signal.throwIfAborted();
  const executable = findCodex();
  if (executable === null) throw new BackendError('internal', codexNotFound());
  try {
    await installCodexSkills(request.workspace, request.skills);
    await rm(request.output, { force: true });
    const env = processEnv();
    const codex = new Codex({
      config: imageConfig(request.systemPrompt),
      codexPathOverride: executable.path,
      env: withPathDirs(executable.pathDirs, env) ?? env,
    });
    const thread = codex.startThread(imageThreadOptions(request.workspace, codexCatalog()));
    onActivity(t('drawing'));
    const { events } = await thread.runStreamed(referSkills(request.workspace, request.skills, request.prompt), {
      signal,
    });
    const reader = new EventReader(onActivity, () => undefined);
    let threadId: string | null = null;
    for await (const event of events) {
      if (event.type === 'thread.started') threadId = event.thread_id;
      reader.read(event);
    }
    if (await isPngFile(request.output)) return;
    const image = threadId === null ? null : await newestPng(generatedImagesDir(codexHome(), threadId));
    if (image === null) throw new BackendError('internal', missingImage(reader.finalText));
    await mkdir(dirname(request.output), { recursive: true });
    await copyFile(image, request.output);
  } catch (error) {
    if (error instanceof BackendError || signal.aborted) throw error;
    throw codexError(errorMessage(error));
  }
}

/** 画像ができなかったときの文面（Codex が何か返していれば、その頭を添える） */
function missingImage(reply: string): string {
  const text = reply.trim().replace(/\s+/g, ' ');
  if (text === '') return t('imageMissing');
  const preview = text.length > REPLY_PREVIEW_CHARS ? `${text.slice(0, REPLY_PREVIEW_CHARS)}…` : text;
  return `${t('imageMissing')} ${t('imageReply', { text: preview })}`;
}

function processEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
