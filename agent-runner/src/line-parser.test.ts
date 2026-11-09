import { describe, expect, it } from 'vitest';
import { LineSplitter, parseLine, serializeEvent } from './line-parser.ts';

describe('LineSplitter', () => {
  it('かたまりの途中で切れた行をつなぎ、改行ごとに分ける', () => {
    const splitter = new LineSplitter();
    expect(splitter.push('{"type":"pro')).toEqual([]);
    expect(splitter.push('be"}\n{"type":"shut')).toEqual(['{"type":"probe"}']);
    expect(splitter.push('down"}\r\n\n')).toEqual(['{"type":"shutdown"}\r', '']);
  });

  it('入力の終わりで、改行のない最後の行を返す', () => {
    const splitter = new LineSplitter();
    splitter.push('{"type":"probe"}');
    expect(splitter.flush()).toEqual(['{"type":"probe"}']);
    expect(splitter.flush()).toEqual([]);
  });
});

describe('parseLine', () => {
  it('空行と空白だけの行は empty', () => {
    expect(parseLine('')).toEqual({ kind: 'empty' });
    expect(parseLine('   \t\r')).toEqual({ kind: 'empty' });
  });

  it('JSON オブジェクトの行は message（CRLF の \\r も許す）', () => {
    expect(parseLine('{"type":"shutdown"}\r')).toEqual({ kind: 'message', value: { type: 'shutdown' } });
  });

  it('壊れた JSON は malformed（理由つき）', () => {
    const parsed = parseLine('{"type":"run",');
    expect(parsed.kind).toBe('malformed');
    if (parsed.kind === 'malformed') expect(parsed.reason).toContain('JSON として読めない');
  });

  it.each(['[1,2]', '42', 'null', '"run"', 'true'])('オブジェクトでない JSON（%s）は malformed', (line) => {
    expect(parseLine(line).kind).toBe('malformed');
  });
});

describe('serializeEvent', () => {
  it('本文に改行があっても1行の JSON になる', () => {
    const line = serializeEvent({ type: 'result', id: 'j1', text: '一行目\n二行目\r\n' });
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toMatch(/[\r\n]/);
    expect(JSON.parse(line)).toEqual({ type: 'result', id: 'j1', text: '一行目\n二行目\r\n' });
  });
});
