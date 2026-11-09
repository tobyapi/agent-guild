import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeProject } from '../../testSupport.mjs';
import { checkProject } from '../checkProject.mjs';

const summarize = (root) => checkProject(root).map(({ file, line, rule }) => `${file}:${line} ${rule}`);

describe('テスト専用のコード', () => {
  it('テストとテスト用の部品は vitest とテスト用の部品を import してよい', () => {
    const root = makeProject({
      'src/shared/lib/harness.test-support.ts': "import { vi } from 'vitest';\nexport const fake = vi.fn;",
      'src/shared/lib/a.test.ts': "import { it } from 'vitest';\nimport { fake } from './harness.test-support';",
      'agent-runner/src/x.test.ts': "import { it } from 'vitest';",
    });
    assert.deepEqual(summarize(root), []);
  });

  it('本番のコードは vitest もテスト用の部品も import しない', () => {
    const root = makeProject({
      'src/shared/lib/harness.test-support.ts': 'export const fake = 1;',
      'src/shared/lib/helper.ts': "import { vi } from 'vitest';\nimport { fake } from './harness.test-support';",
      'agent-runner/src/helper.ts': "import { vi } from 'vitest';",
    });
    assert.deepEqual(summarize(root), [
      'agent-runner/src/helper.ts:1 vitest-outside-tests',
      'src/shared/lib/helper.ts:1 vitest-outside-tests',
      'src/shared/lib/helper.ts:2 test-support-in-production',
    ]);
  });
});
