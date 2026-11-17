import { expect, it } from 'vitest';
import backends from '../../../../contracts/runner/api-backends.json' with { type: 'json' };
import { providers } from './provider.test-support.ts';
import { setLanguage } from '../../i18n.ts';

it('keeps the shared UI test fixture identical to production backend descriptors and catalogs', async () => {
  setLanguage('ja');
  const actual = await Promise.all(
    providers.map(async ({ adapter }) => ({
      ...adapter.info(),
      ...(await adapter.catalog!()),
      status: 'needs_auth',
      statusMessage: '',
    })),
  );
  expect(actual).toEqual(backends);
});
