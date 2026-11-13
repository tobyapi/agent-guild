// 新しい版を自動で確かめるか（起動時と一定の間隔）。オフでも［更新を確認］を押せば確かめる。
// 保存先は localStorage。値がない（以前の版を含む）・読めないときはオン

export const AUTO_CHECK_STORAGE_KEY = 'agent-guild.update.autoCheck';

export function parseAutoCheck(stored: string | null): boolean {
  return stored !== 'off';
}

export function serializeAutoCheck(enabled: boolean): string {
  return enabled ? 'on' : 'off';
}
