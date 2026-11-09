import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { runCodex } from '../../agent-runner/src/backends/codex-runtime.ts';

const root = resolve(process.argv[2]);
const backend = process.argv[3] ?? 'grok';
if (!['grok', 'muse'].includes(backend)) throw new Error('Unsupported test backend');
const createProvider =
  backend === 'muse'
    ? (await import('../../agent-runner/src/backends/muse.ts')).museProvider
    : (await import('../../agent-runner/src/backends/grok.ts')).grokProvider;
await mkdir(root, { recursive: true });
const requests = [];
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const request = JSON.parse(body);
  requests.push({ url: req.url, body: request });
  await writeFile(resolve(root, 'requests.json'), JSON.stringify(requests, null, 2));
  const tool = request.tools.find((t) => t.type === 'function' && /^(shell|exec_command)$/.test(t.name));
  const output =
    requests.length === 1 && tool
      ? [
          {
            type: 'function_call',
            id: 'fc_test',
            call_id: 'call_test',
            name: tool.name,
            arguments: JSON.stringify(
              tool.name === 'shell'
                ? {
                    command: ['powershell', '-NoProfile', '-Command', "Write-Output 'wire-test'"],
                    timeout_ms: 1000,
                    workdir: root,
                  }
                : { cmd: "Write-Output 'wire-test'", max_output_tokens: 100 },
            ),
          },
        ]
      : [
          {
            type: 'message',
            id: 'msg_test',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'local test complete', annotations: [] }],
          },
        ];
  if (requests.length === 1)
    output.unshift({ type: 'reasoning', id: 'rs_test', summary: [], encrypted_content: 'local-ciphertext' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  send({
    type: 'response.created',
    response: { id: `resp_${requests.length}`, object: 'response', status: 'in_progress' },
  });
  for (const [index, item] of output.entries()) {
    send({ type: 'response.output_item.added', output_index: index, item });
    send({ type: 'response.output_item.done', output_index: index, item });
  }
  send({
    type: 'response.completed',
    response: {
      id: `resp_${requests.length}`,
      object: 'response',
      status: 'completed',
      output,
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    },
  });
  res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const provider = createProvider(root, {
  MODEL_API_KEY: 'local-dummy-key',
  XAI_API_KEY: 'local-dummy-key',
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: root,
  TMP: root,
});
const api = provider.config.model_providers[backend === 'muse' ? 'guild_meta' : 'guild_xai'];
api.base_url = 'http://127.0.0.1:' + server.address().port + '/v1';
api.request_max_retries = 0;
// Capture the real SDK serialization, then launch the CLI from PowerShell because Node spawn is restricted here.
let captured = false;
childProcess.spawn = (executable, args, options) => {
  writeFileSync(
    resolve(root, 'launch.json'),
    JSON.stringify({ executable, args, env: options.env, home: options.env.CODEX_HOME }),
  );
  captured = true;
  throw new Error('launch captured');
};
syncBuiltinESMExports();
const request = {
  type: 'run',
  id: 'wire',
  backend,
  workspace: root,
  stateDir: root,
  readableDirs: [],
  model: '',
  prompt: 'Local synthetic wire test.',
  systemPrompt: 'Synthetic test only.',
  intent: '',
  options: {},
  skills: [],
  images: [],
  permissions: {
    webSearch: false,
    webFetch: false,
    readFiles: true,
    writeFiles: true,
    writeAnywhere: false,
    runCommands: true,
    skills: true,
  },
};
await mkdir(provider.env.CODEX_HOME, { recursive: true });
try {
  await runCodex(request, { signal: new AbortController().signal, onActivity() {}, onPost() {} }, provider);
} catch (error) {
  if (!captured) throw error;
}
setTimeout(() => {
  server.closeAllConnections();
  server.close();
}, 45000);
