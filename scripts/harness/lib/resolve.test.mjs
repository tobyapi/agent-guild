import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeProject } from '../testSupport.mjs';
import { resolveSpecifier } from './resolve.mjs';

const root = makeProject({
  'src/features/agents/index.ts': '',
  'src/features/agents/store.ts': '',
  'src/shared/ui/Button.tsx': '',
  'agent-runner/src/backends/types.ts': '',
});

const resolve = (specifier, from) => resolveSpecifier(specifier, from, root);

describe('resolveSpecifier', () => {
  it('@/ は src/ の別名で、ディレクトリなら index を補う', () => {
    assert.deepEqual(resolve('@/features/agents', 'src/app/App.tsx'), {
      kind: 'file',
      path: 'src/features/agents/index.ts',
    });
    assert.deepEqual(resolve('@/features/agents/store', 'src/app/App.tsx'), {
      kind: 'file',
      path: 'src/features/agents/store.ts',
    });
  });

  it('相対パスを import 元から解決し、拡張子（.tsx も）を補う', () => {
    assert.deepEqual(resolve('../../shared/ui/Button', 'src/features/chat/Chat.tsx'), {
      kind: 'file',
      path: 'src/shared/ui/Button.tsx',
    });
    assert.deepEqual(resolve('../agents', 'src/features/chat/api.ts'), {
      kind: 'file',
      path: 'src/features/agents/index.ts',
    });
  });

  it('.ts 指定はそのまま、NodeNext の .js 指定は .ts に読み替える', () => {
    const from = 'agent-runner/src/backends/claude.ts';
    assert.deepEqual(resolve('./types.ts', from), { kind: 'file', path: 'agent-runner/src/backends/types.ts' });
    assert.deepEqual(resolve('./types.js', from), { kind: 'file', path: 'agent-runner/src/backends/types.ts' });
  });

  it('見つからないファイルは正規化したパスを返す', () => {
    assert.deepEqual(resolve('@/features/missing/store', 'src/app/App.tsx'), {
      kind: 'file',
      path: 'src/features/missing/store',
    });
  });

  it('それ以外はパッケージ名（スコープつきは2段）', () => {
    assert.deepEqual(resolve('@tauri-apps/api/core', 'src/a.ts'), { kind: 'package', name: '@tauri-apps/api' });
    assert.deepEqual(resolve('zustand/middleware', 'src/a.ts'), { kind: 'package', name: 'zustand' });
    assert.deepEqual(resolve('node:fs', 'src/a.ts'), { kind: 'package', name: 'node:fs' });
  });
});
