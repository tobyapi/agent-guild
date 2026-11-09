// runner-client のテスト用の偽ランナー。プロトコル（agent-runner/src/protocol.ts）を話し、prompt の中身で振る舞いを変える。
//   echo:<text>  activity を1回送ってから result      pid      自分のプロセス ID を返す
//   inspect      受け取った run 要求を JSON で返す      context  引数・環境変数・作業ディレクトリを返す
//   fail:<code>  その code の error を返す             crash    異常終了する
//   hang         cancel されたら error{cancelled}      stubborn cancel を無視して終わらない
//   late         cancel されたら 100ms 後に result（中断が間に合わなかった完了）
// login は状態を ready にして backends を送ってから result（text は空）で終える。
// 起動時の振る舞い（版・ready を送るか）は各エントリ（ok.mjs など）が startFakeRunner の引数で決める。

import { createInterface } from 'node:readline';

export const BACKEND = {
  id: 'fake',
  label: 'Fake',
  modelSuggestions: ['m1'],
  defaultModel: 'm1',
  capabilities: { webSearch: true, webFetch: false, readFiles: true, writeFiles: true, writeAnywhere: false, runCommands: false, skills: true },
  status: 'ready',
  statusMessage: '',
  options: [{ key: 'maxTurns', label: '最大ターン数', description: '', type: 'number', choices: [], default: 30 }],
  permissionRules: [{ when: 'writeFiles', requires: ['runCommands'] }],
  canLogin: true,
  addedLater: true, // 未知のフィールドは無視されるはず
};

const send = (event) => process.stdout.write(`${JSON.stringify(event)}\n`);

function startJob(request, waiting) {
  const [command, argument = ''] = request.prompt.split(/:(.*)/s);
  const reply = (text) => send({ type: 'result', id: request.id, text });
  switch (command) {
    case 'echo':
      send({ type: 'activity', id: request.id, detail: `working:${argument}`, addedLater: 1 });
      return reply(argument);
    case 'pid':
      return reply(String(process.pid));
    case 'inspect':
      return reply(JSON.stringify(request));
    case 'context':
      return reply(JSON.stringify({ args: process.argv.slice(2), flag: process.env.FAKE_FLAG ?? null, cwd: process.cwd() }));
    case 'fail':
      return send({ type: 'error', id: request.id, code: argument, message: `失敗: ${argument}` });
    case 'crash':
      return process.exit(3);
    default:
      waiting.set(request.id, command);
      return send({ type: 'activity', id: request.id, detail: 'waiting' });
  }
}

function cancelJob(id, waiting) {
  const mode = waiting.get(id);
  waiting.delete(id);
  if (mode === 'hang') send({ type: 'error', id, code: 'cancelled', message: '実行を中断しました' });
  if (mode === 'late') setTimeout(() => send({ type: 'result', id, text: 'too late' }), 100);
}

export function startFakeRunner({ protocolVersion = 1, sendReady = true } = {}) {
  const waiting = new Map();
  const handlers = {
    run: (request) => startJob(request, waiting),
    cancel: ({ id }) => cancelJob(id, waiting),
    login: ({ id }) => {
      send({ type: 'backends', backends: [{ ...BACKEND, status: 'ready' }] });
      send({ type: 'result', id, text: '' });
    },
    probe: () => send({ type: 'backends', backends: [{ ...BACKEND, status: 'needs_auth', statusMessage: 'ログインしてください' }] }),
    shutdown: () => process.exit(0),
  };
  process.stderr.write(`fake-runner: pid ${process.pid}\n`);
  if (sendReady) {
    send({ type: 'from-the-future', payload: 1 }); // 未知の type は無視されるはず
    process.stdout.write('this line is not json\n'); // 壊れた行も無視されるはず
    send({ type: 'ready', protocolVersion, runnerVersion: 'fake-1', backends: [BACKEND] });
  }
  createInterface({ input: process.stdin })
    .on('line', (line) => {
      const request = JSON.parse(line);
      handlers[request.type]?.(request);
    })
    .on('close', () => process.exit(0));
}
