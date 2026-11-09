import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeProject } from '../../testSupport.mjs';
import { checkProject } from '../checkProject.mjs';

/** 違反を「ファイル:行 規則名」の一覧にする */
const summarize = (root) => checkProject(root).map(({ file, line, rule }) => `${file}:${line} ${rule}`);

const FEATURES = {
  'src/features/agents/index.ts': "export * from './store';",
  'src/features/agents/store.ts': 'export const store = 1;',
  'src/features/agents/api.ts': "import { invoke } from '@/shared/api';",
  'src/features/chat/index.ts': '',
  'src/shared/api/index.ts': "import { invoke } from '@tauri-apps/api/core';\nexport { invoke };",
  'src/app/App.tsx': "import { invoke } from '@/shared/api';\nimport { store } from '@/features/agents';",
};

describe('React の import 境界', () => {
  it('規約どおりなら違反なし', () => {
    assert.deepEqual(summarize(makeProject(FEATURES)), []);
  });

  it('shared は features・app を、features は app を import しない（相対パスでも）', () => {
    const root = makeProject({
      ...FEATURES,
      'src/shared/lib/bad.ts': "import { store } from '@/features/agents';\nimport App from '../../app/App';",
      'src/features/chat/bad.ts': "import App from '@/app/App';",
    });
    assert.deepEqual(summarize(root), [
      'src/features/chat/bad.ts:1 features-imports-app',
      'src/shared/lib/bad.ts:1 shared-imports-upper',
      'src/shared/lib/bad.ts:2 shared-imports-upper',
    ]);
  });

  it('別の feature は index 経由だけ（export * や動的 import も検査する）', () => {
    const root = makeProject({
      ...FEATURES,
      'src/features/chat/ok.ts': "import { store } from '@/features/agents';\nimport x from '../agents/index';",
      'src/features/chat/deep.ts': [
        "import { store } from '@/features/agents/store';",
        "export * from '../agents/store';",
        "const m = await import('@/features/agents/store');",
      ].join('\n'),
      'src/app/deep.ts': "import { store } from '@/features/agents/store';",
    });
    assert.deepEqual(summarize(root), [
      'src/app/deep.ts:1 feature-deep-import',
      'src/features/chat/deep.ts:1 feature-deep-import',
      'src/features/chat/deep.ts:2 feature-deep-import',
      'src/features/chat/deep.ts:3 feature-deep-import',
    ]);
  });

  it('@tauri-apps/* は shared/api だけ、@/shared/api は features/*/api.ts と app/ だけ（テストは可）', () => {
    const root = makeProject({
      ...FEATURES,
      'src/features/chat/components/Send.tsx': "import { invoke } from '@/shared/api';\nimport { open } from '@tauri-apps/plugin-dialog';",
      'src/shared/ui/Thing.tsx': "import { invoke } from '../api';",
      'src/features/chat/store.test.ts': "import { createMock } from '@/shared/api/mock/runtime';",
    });
    assert.deepEqual(summarize(root), [
      'src/features/chat/components/Send.tsx:1 shared-api-outside-api-layer',
      'src/features/chat/components/Send.tsx:2 tauri-outside-shared-api',
      'src/shared/ui/Thing.tsx:1 shared-api-outside-api-layer',
    ]);
  });

  it('index.ts のない feature を見つける', () => {
    const root = makeProject({ ...FEATURES, 'src/features/skills/store.ts': '' });
    assert.deepEqual(summarize(root), ['src/features/skills:1 feature-missing-index']);
  });
});
