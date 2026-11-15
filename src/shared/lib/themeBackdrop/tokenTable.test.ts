import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTokenTable, readTokenUnit } from './tokenTable';
import type { SourceFile, TokenTable } from './tokenTable';
import { compositeColor, resolveTokenColor } from './tokenColors';

const root = resolve(import.meta.dirname, '../../../../..');
function filesIn(directory: string): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}
const files: SourceFile[] = filesIn('src')
  .filter(
    (file) => /\.(css|tsx?)$/.test(file) && !/\.test|test-support/.test(file) && !file.includes('/themeBackdrop/'),
  )
  .sort()
  .map((file) => ({ file, text: readFileSync(resolve(root, file), 'utf8') }));
const table = JSON.parse(
  readFileSync(resolve(root, 'contracts/behavior/theme-backdrop-token-table.json'), 'utf8'),
) as TokenTable;

describe('static text/surface token inventory', () => {
  it('matches all source declarations and resolved values in the checked-in table', () => {
    expect(buildTokenTable(files)).toEqual(table);
  });
  it('detects changed CSS values and newly added tokens', () => {
    for (const change of [
      (s: string) => s.replace('#9a9ea7', '#000000'),
      (s: string) => s.replace(':root {', ':root {\n--text-new: #123456;'),
    ]) {
      const changed = files.map((file) =>
        file.file.endsWith('/tokens.css') ? { ...file, text: change(file.text) } : file,
      );
      expect(buildTokenTable(changed)).not.toEqual(table);
    }
  });
  it('detects a new component color or opacity declaration', () => {
    const changed = [...files, { file: 'src/new.css', text: '.new { color: #123456; opacity: 0.4; }' }];
    expect(buildTokenTable(changed)).not.toEqual(table);
  });
  it('reads six units without mutation and keeps uncertainty visible', () => {
    expect(table.units).toHaveLength(6);
    const before = JSON.stringify(table);
    for (const unit of table.units) {
      expect(readTokenUnit(table, unit.name)).toBe(unit);
      expect(unit.rows.some((row) => row.status === 'unresolved')).toBe(true);
      expect(unit.rows.some((row) => row.status === 'dynamic')).toBe(true);
      expect(unit.rows.every((row) => row.sources.length > 0 && row.sources.every((s) => s.line > 0))).toBe(true);
    }
    expect(JSON.stringify(table)).toBe(before);
    expect(() => readTokenUnit(table, 'unknown')).toThrow('Unknown token unit');
  });
  it('resolves nested variables with fallback and refuses cycles or unsupported CSS', () => {
    const defs = {
      '--a': { file: 'test', line: 1, expression: 'var(--b, var(--c))' },
      '--c': { file: 'test', line: 2, expression: '#ff0000' },
    };
    expect(resolveTokenColor('var(--a)', defs)).toEqual({ rgb: [1, 0, 0], alpha: 1 });
    expect(
      resolveTokenColor('var(--cycle)', { '--cycle': { file: 'test', line: 1, expression: 'var(--cycle)' } }),
    ).toBeNull();
    for (const value of ['currentColor', 'inherit', 'oklch(50% 0.2 10)', 'rgba(256,0,0,1)'])
      expect(resolveTokenColor(value, {})).toBeNull();
  });
  it('mixes sRGB using premultiplied alpha and composites overlays in paint order', () => {
    const defs = { '--a': { file: 'test', line: 1, expression: '#ff0000' } };
    expect(resolveTokenColor('color-mix(in srgb, var(--a) 25%, transparent)', defs)).toEqual({
      rgb: [1, 0, 0],
      alpha: 0.25,
    });
    const black = { rgb: [0, 0, 0] as const, alpha: 1 };
    expect(compositeColor({ rgb: [1, 0, 0], alpha: 0.5 }, black)).toEqual({ rgb: [0.5, 0, 0], alpha: 1 });
    expect(
      compositeColor({ rgb: [0, 1, 0], alpha: 0.5 }, compositeColor({ rgb: [1, 0, 0], alpha: 0.5 }, black)),
    ).toEqual({ rgb: [0.25, 0.5, 0], alpha: 1 });
  });
});
