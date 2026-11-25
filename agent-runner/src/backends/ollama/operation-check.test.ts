import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkOperation } from './operation-check.ts';
import { localHttp } from './http.ts';
import { pretendMacOS, runContext, runRequest } from '../run.test-support.ts';

vi.mock('./http.ts', () => ({ localHttp: vi.fn() }));
const http = vi.mocked(localHttp);
const model = { id: 'tools:1b', size: '', capabilities: ['completion', 'thinking'] };
const request = () => ({
  ...runRequest('ollama'),
  intent: 'テストして。',
  options: { enableTools: true, operationCheck: true },
});
const args = { command: 'npm test' };

function answer(content: string, done_reason = 'stop') {
  http.mockResolvedValueOnce({ status: 200, text: JSON.stringify({ message: { content }, done_reason }) });
}

beforeEach(() => http.mockReset());

describe('Ollama の操作確認', () => {
  pretendMacOS();

  it.each([
    'ALLOW',
    'allow.',
    '**Allow** です。',
    '「ALLOW」',
    'The tests are part of the task.\n- **Verdict:** **allow**. This checks the change.',
    'The verdict is Allow: the command runs the requested tests.',
    '判定: allow：依頼されたテストです。',
    '```text\nALLOW: Valid.\n```',
  ])('明示的な許可の書式ゆれを通す (%s)', async (content) => {
    answer(content);
    const context = runContext();
    const req = request();
    req.prompt = '信頼しない会話履歴';
    await expect(checkOperation(req, model, 'run_command', args, context)).resolves.toBeNull();
    expect(context.onPost).not.toHaveBeenCalled();
    const body = JSON.parse(http.mock.calls[0]?.[2] ?? '{}') as { messages: { content: string }[] };
    expect(body).toMatchObject({ think: false, options: { num_predict: 256 } });
    expect(JSON.parse(body.messages[1]!.content)).toEqual({
      trustedTask: req.intent,
      workspace: req.workspace,
      operation: { name: 'run_command', args },
    });
  });

  it('明示的な拒否の理由と対処方法を通知し、同じ操作を繰り返さないよう伝える', async () => {
    answer('ALLOW.\nCorrection\n**Deny**: 対象が依頼の範囲外です');
    const context = runContext();
    await expect(checkOperation(request(), model, 'run_command', args, context)).resolves.toContain(
      '対象が依頼の範囲外です\n同じ操作を繰り返さず',
    );
    expect(context.onPost).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(
        /🛡️ 操作の確認で止めました（コマンドの実行）: 対象が依頼の範囲外です\n\nnpm test\n\n.*エージェント設定の「操作を実行前に確認する」でオフ/,
      ),
    );
  });

  it('書き込み通知に長いパスの冒頭を表示し、ファイル本文を含めない', async () => {
    answer('deny');
    const context = runContext();
    const req = request();
    req.permissions.writeAnywhere = true;
    const path = `/tmp/${'x'.repeat(200)}`;
    await expect(checkOperation(req, model, 'write_file', { path, content: '本文' }, context)).resolves.toContain(
      'モデルは拒否の理由を返しませんでした',
    );
    expect(context.onPost).toHaveBeenCalledWith(expect.stringContaining(`\n\n${path.slice(0, 160)}…\n\n`));
    expect(context.onPost).not.toHaveBeenCalledWith(expect.stringContaining('本文'));
  });

  it.each(['', 'I cannot allow this.', 'ALLOW-ISH', 'ALLOW: however, I would deny this.'])(
    '曖昧な応答で実行を止める (%s)',
    async (content) => {
      answer(content);
      const context = runContext();
      await expect(checkOperation(request(), model, 'run_command', args, context)).resolves.toContain(
        'モデルの判定を読み取れませんでした',
      );
      expect(context.onPost).toHaveBeenCalledTimes(1);
    },
  );

  it('出力上限で途切れた ALLOW を許可として扱わない', async () => {
    answer('ALLOW: 対象は', 'length');
    await expect(checkOperation(request(), model, 'run_command', args, runContext())).resolves.toContain(
      'モデルの判定を読み取れませんでした',
    );
  });

  it('判定の通信エラーは操作の拒否として扱う', async () => {
    http.mockRejectedValueOnce(new Error('mock network error'));
    await expect(checkOperation(request(), model, 'run_command', args, runContext())).resolves.toContain(
      '操作を確認できませんでした',
    );
  });

  it('親ジョブの中断は拒否通知として扱わない', async () => {
    const controller = new AbortController();
    http.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new Error('mock abort'));
    });
    const context = runContext(controller.signal);
    await expect(checkOperation(request(), model, 'run_command', args, context)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(context.onPost).not.toHaveBeenCalled();
  });

  it('信頼できる依頼が空なら会話履歴を代用せず拒否する', async () => {
    const req = { ...request(), intent: '  ' };
    await expect(checkOperation(req, model, 'run_command', args, runContext())).resolves.toContain(
      '判定に使える依頼の情報がありませんでした',
    );
    expect(http).not.toHaveBeenCalled();
  });

  it('設定オフでも役割が許可しない操作は実行できない', async () => {
    const req = request();
    req.options.operationCheck = false;
    await expect(checkOperation(req, model, 'run_command', args, runContext())).resolves.toBeNull();
    req.permissions.runCommands = false;
    await expect(checkOperation(req, model, 'run_command', args, runContext())).rejects.toMatchObject({
      code: 'unsupported_permission',
    });
    expect(http).not.toHaveBeenCalled();
  });
});
