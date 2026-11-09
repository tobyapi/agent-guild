import { describe, expect, it } from 'vitest';
import { isSecretName, SECRET_ENV_GLOBS, withoutSecrets } from './agent-env.ts';

describe('isSecretName', () => {
  it('トークン・API キー・パスワード・資格情報らしい名前', () => {
    const secrets = [
      'GITHUB_TOKEN',
      'OPENAI_API_KEY',
      'AWS_SECRET_ACCESS_KEY',
      'DB_PASSWORD',
      'SMTP_PASS',
      'GH_PAT',
      'SSH_AUTH_SOCK',
    ];
    for (const name of [...secrets, 'npm_config__authToken', 'GOOGLE_APPLICATION_CREDENTIALS', 'STRIPE_KEY']) {
      expect(isSecretName(name), name).toBe(true);
    }
  });

  it('区切りで分けた語で見るので、PATH・KEYBOARD・AUTHOR は秘密ではない', () => {
    for (const name of [
      'PATH',
      'Path',
      'HOME',
      'USERPROFILE',
      'KEYBOARD_LAYOUT',
      'GIT_AUTHOR_NAME',
      'HTTPS_PROXY',
      'NODE_EXTRA_CA_CERTS',
    ]) {
      expect(isSecretName(name), name).toBe(false);
    }
  });
});

describe('withoutSecrets', () => {
  it('秘密らしい変数を除き、keep の名前と値のないものの扱いを守る', () => {
    const env = { PATH: '/bin', GITHUB_TOKEN: 'x', ANTHROPIC_API_KEY: 'y', EMPTY: undefined };
    expect(withoutSecrets(env, (name) => name.startsWith('ANTHROPIC_'))).toEqual({
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'y',
    });
  });
});

describe('SECRET_ENV_GLOBS', () => {
  it('部分一致の語は *語*、区切りの語は前後の区切りつき', () => {
    expect(SECRET_ENV_GLOBS).toEqual(
      expect.arrayContaining(['*TOKEN*', '*PASSWORD*', 'PAT', 'PAT_*', '*_PAT', '*_PAT_*']),
    );
    expect(SECRET_ENV_GLOBS).not.toContain('*PAT*');
  });
});
