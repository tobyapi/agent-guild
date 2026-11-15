// Rust が保存値を読み替えたあと、IPC は shared の形だけを返す。
import { expect, it } from 'vitest';
import cases from '../../../contracts/behavior/channel-workspaces.json';
import { objectOf } from './schema';
import { workspaceSchema } from './schemas/entities';

it.each(cases)('保存済みの $saved.mode が返す IPC の形', ({ saved, loaded }) => {
  const validate = objectOf(workspaceSchema);
  expect(validate(loaded, 'workspace')).toEqual([]);
  if (saved.mode !== 'shared') expect(validate(saved, 'workspace')).not.toEqual([]);
});
