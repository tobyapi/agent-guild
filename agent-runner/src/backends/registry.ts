// アダプタの登録表。新しいバックエンドは backends/<id>.ts に BackendAdapter を実装し、BUILTIN_ADAPTERS に1行足す。
// Rust・React の変更は不要（能力・状態・設定項目はアダプタが申告し、ready / backends で届く）。

import { errorMessage, logInfo } from '../log.ts';
import type { BackendInfo } from '../protocol.ts';
import { claudeAdapter } from './claude.ts';
import { codexAdapter } from './codex.ts';
import { grokAdapter } from './grok.ts';
import { museAdapter } from './muse.ts';
import { ollamaAdapter } from './ollama.ts';
import { EMPTY_CATALOG, type BackendAdapter, type BackendProbe, type ModelCatalog } from './types.ts';

const BUILTIN_ADAPTERS: readonly BackendAdapter[] = [
  claudeAdapter,
  codexAdapter,
  grokAdapter,
  museAdapter,
  ollamaAdapter,
];

export class BackendRegistry {
  readonly #adapters = new Map<string, BackendAdapter>();

  constructor(adapters: readonly BackendAdapter[]) {
    for (const adapter of adapters) {
      const { id } = adapter.info();
      if (this.#adapters.has(id)) throw new Error(`バックエンド ID が重複しています: ${id}`);
      this.#adapters.set(id, adapter);
    }
  }

  find(id: string): BackendAdapter | undefined {
    return this.#adapters.get(id);
  }

  /** 各アダプタの情報に状態（probe の結果）を合わせる。probe に失敗したアダプタは unavailable として申告する */
  describe(): Promise<BackendInfo[]> {
    return Promise.all([...this.#adapters.values()].map(describeAdapter));
  }
}

async function describeAdapter(adapter: BackendAdapter): Promise<BackendInfo> {
  const [probe, catalog] = await Promise.all([probeOf(adapter), catalogOf(adapter)]);
  return { ...adapter.info(), ...catalog, ...probe };
}

/** probe に失敗したら unavailable */
async function probeOf(adapter: BackendAdapter): Promise<BackendProbe> {
  try {
    return await adapter.probe();
  } catch (error) {
    return { status: 'unavailable', statusMessage: `状態を確認できませんでした（${errorMessage(error)}）` };
  }
}

/** モデルの一覧を聞けなければ、分からないとする */
async function catalogOf(adapter: BackendAdapter): Promise<ModelCatalog> {
  try {
    return (await adapter.catalog?.()) ?? EMPTY_CATALOG;
  } catch (error) {
    logInfo(`${adapter.info().id} のモデルの一覧を確認できませんでした（${errorMessage(error)}）`);
    return EMPTY_CATALOG;
  }
}

export const createBuiltinRegistry = (): BackendRegistry => new BackendRegistry(BUILTIN_ADAPTERS);
