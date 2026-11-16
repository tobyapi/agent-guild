import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { BackendError } from '../types.ts';
import { controls } from './characters.ts';

const denied = () => new BackendError('unsupported_permission', 'Grok URL is not a public HTTP(S) destination.');
const invalid = () => new BackendError('bad_request', 'Grok URL fetch failed or exceeded its limits.');

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blocked.addSubnet(network, prefix, 'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
for (const [network, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]] as const) blocked.addSubnet(network, prefix, 'ipv6');

/** Conservative global-unicast allowlist; reject transition, mapped and special ranges. */
export function publicIP(address: string): boolean {
  if (isIP(address) === 4) return !blocked.check(address, 'ipv4');
  if (isIP(address) !== 6) return false;
  return global6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export function publicURL(raw: string): URL {
  if (controls(raw, true)) throw denied();
  let url: URL;
  try { url = new URL(raw); } catch { throw denied(); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw denied();
  return url;
}

async function hop(url: URL, signal: AbortSignal): Promise<{ location?: string; text: string }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(item => !publicIP(item.address))) throw denied();
  const selected = addresses[0]!;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    // The validated address is the only address used by the socket; no second DNS lookup.
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      signal, agent: false, family: selected.family, headers: { 'Accept-Encoding': 'identity' },
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
        response.destroy(); resolve({ location: response.headers.location, text: '' }); return;
      }
      if (response.statusCode !== 200 || response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.destroy(); reject(invalid()); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) { response.destroy(); reject(invalid()); }
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', () => reject(invalid()));
      response.on('aborted', () => reject(invalid()));
    });
    req.on('error', () => reject(invalid()));
    req.end();
  });
}

export async function fetchURL(raw: string, signal: AbortSignal): Promise<string> {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  let url = publicURL(raw);
  for (let redirect = 0; redirect <= 5; redirect++) {
    bounded.throwIfAborted();
    const result = await hop(url, bounded);
    if (!result.location) return result.text;
    url = publicURL(new URL(result.location, url).href);
  }
  throw invalid();
}
