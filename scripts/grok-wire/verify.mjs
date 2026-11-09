import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.argv[2]);
const backend = process.argv[3] ?? 'grok';
assert.ok(['grok', 'muse'].includes(backend));
const requests = JSON.parse(await readFile(resolve(root, 'requests.json'), 'utf8'));
assert.equal(requests.length, 2, 'Expected a tool round trip');
for (const { url, body } of requests) {
  assert.equal(url, '/v1/responses');
  assert.equal(body.model, backend === 'muse' ? 'muse-spark-1.3' : 'grok-4.7');
  assert.equal(body.tool_choice, 'auto');
  assert.equal(body.stream, true);
  assert.ok(body.tools.length > 0);
  for (const tool of body.tools) {
    assert.equal(tool.type, 'function', 'Unsupported Codex tool type; do not enable upstream without translation');
    assert.equal(tool.parameters.type, 'object');
    if (backend === 'muse') {
      assert.match(tool.name, /^[a-zA-Z0-9_.-]+$/);
      assert.ok((tool.name.match(/\./g) ?? []).length <= 1);
    }
  }
  assert.equal(body.reasoning.effort, 'high');
  if (backend === 'grok') assert.deepEqual(body.reasoning, { effort: 'high' });
  assert.ok(body.include.includes('reasoning.encrypted_content'));
}
const input = requests[1].body.input;
assert.ok(input.some(i => i.type === 'reasoning' && i.encrypted_content === 'local-ciphertext'));
assert.ok(input.some(i => i.type === 'function_call' && i.call_id === 'call_test'));
assert.ok(input.some(i => i.type === 'function_call_output' && i.call_id === 'call_test' && typeof i.output === 'string'));
const events = (await readFile(resolve(root, 'cli-events.jsonl'), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
assert.ok(events.some(e => e.type === 'turn.completed'));
assert.ok(events.some(e => e.item?.type === 'agent_message' && e.item.text === 'local test complete'));
assert.ok(!events.some(e => e.type === 'turn.failed'));
console.log('Local CLI wire assertions passed (not an upstream API compatibility test).');
