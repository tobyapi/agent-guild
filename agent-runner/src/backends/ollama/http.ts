import { request } from 'node:http';

/** ループバックへ直接接続する。プロキシ設定やリダイレクトを経由させない。 */
export function localHttp(
  path: string,
  signal: AbortSignal,
  payload?: string,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port: 11434,
        path,
        agent: false,
        signal,
        method: payload === undefined ? 'GET' : 'POST',
        headers:
          payload === undefined
            ? undefined
            : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
      },
      (res) => {
        const chunks: string[] = [];
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => chunks.push(chunk));
        res.once('error', reject);
        res.once('end', () => resolve({ status: res.statusCode ?? 0, text: chunks.join('') }));
      },
    );
    req.once('error', reject);
    req.end(payload);
  });
}
