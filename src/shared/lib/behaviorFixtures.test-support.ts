// Rust と TS の両方が読む振る舞いの実例（contracts/behavior/*.json。contracts/README.md）を読む。
const fixtures = import.meta.glob<unknown>('/contracts/behavior/*.json', { eager: true, import: 'default' });

/** 実例のエージェント（削除済みなら deleted: true） */
export interface FixtureAgent {
  id: string;
  name: string;
  deleted?: boolean;
}

/** contracts/behavior/<name> の中身。なければ失敗させる（0件のまま黙って通さない） */
export function behaviorFixture<T>(name: string): T {
  const value = fixtures[`/contracts/behavior/${name}`];
  if (value === undefined) throw new Error(`contracts/behavior/${name} がありません`);
  return value as T;
}

/** 削除されていないエージェント（TS 側の関数は、呼び出し側が削除済みを除いて渡す） */
export const activeFixtureAgents = (agents: readonly FixtureAgent[]) => agents.filter((agent) => !agent.deleted);
