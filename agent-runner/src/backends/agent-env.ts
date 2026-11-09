// エージェントに渡す環境変数。秘密らしい名前の変数（トークン・パスワード・API キーなど）はコマンドから見えないようにする
// （資料に紛れた指示で読まれて、外へ持ち出されないように）。バックエンド自身の認証に要るものは、アダプタが残す。

/** 名前のどこかに含まれていたら秘密とみなす語 */
const SECRET_PARTS = ['TOKEN', 'SECRET', 'PASSWORD', 'PASSWD', 'PASSPHRASE', 'CREDENTIAL'];

/** 名前を区切り（_ など）で分けた語のどれかがこれなら秘密とみなす（KEYBOARD・AUTHOR・PATH などは捨てない） */
const SECRET_WORDS = ['KEY', 'KEYS', 'APIKEY', 'AUTH', 'PASS', 'PAT', 'CREDS', 'COOKIE', 'COOKIES'];

/** 秘密らしい名前か（値は見ない） */
export function isSecretName(name: string): boolean {
  const upper = name.toUpperCase();
  if (SECRET_PARTS.some((part) => upper.includes(part))) return true;
  return upper.split(/[^A-Z0-9]+/).some((word) => SECRET_WORDS.includes(word));
}

/** env から秘密らしい変数を除いた写し（keep が true の名前は残す） */
export function withoutSecrets(env: NodeJS.ProcessEnv, keep: (name: string) => boolean): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && (keep(name) || !isSecretName(name))) result[name] = value;
  }
  return result;
}

/**
 * isSecretName と同じ規則の glob（Codex の shell_environment_policy.exclude 用。Codex のコマンドに渡す環境変数から除く）。
 * Codex の既定の除外には頼らない（codex sandbox で確かめたところ、既定では *TOKEN* なども渡っていた）
 */
export const SECRET_ENV_GLOBS: readonly string[] = [
  ...SECRET_PARTS.map((part) => `*${part}*`),
  ...SECRET_WORDS.flatMap((word) => [word, `${word}_*`, `*_${word}`, `*_${word}_*`]),
];
