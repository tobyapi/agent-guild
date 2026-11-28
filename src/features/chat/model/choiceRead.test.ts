import { expect, it } from 'vitest';
import { HUMAN_ID, SYSTEM_ID } from '@/shared/types/domain';
import { labelProblem } from './a2uiChoices';
import { findActiveProposal, findAnswers, readChoiceView, salvageLabels } from './choiceRead';
import {
  fence,
  humanMessage,
  message,
  PROMPT_SAMPLE,
  proposal,
  SAMPLE_LABELS,
  sampleSurface,
  type Surface,
} from './choiceFixtures.test-support';

const read = (content: string) => readChoiceView(message({ content })).read;
const edited = (edit: (surface: Surface) => void) => {
  const surface = sampleSurface();
  edit(surface);
  return proposal(JSON.stringify(surface));
};

it('turns the prompt sample into three buttons and removes the block from the body', () => {
  expect(PROMPT_SAMPLE.length).toBeGreaterThan(300);
  const view = readChoiceView(message());
  expect(view).toEqual({ content: 'どこまで進める？', read: { kind: 'buttons', labels: SAMPLE_LABELS } });
});

it('accepts other valid component IDs when the references match', () => {
  const content = PROMPT_SAMPLE.replaceAll('"b"', '"btn"').replaceAll('"child":"t"', '"child":"label"');
  const json = content.replace('{"id":"t","component":"Text"', '{"id":"label","component":"Text"');
  expect(read(proposal(json))).toEqual({ kind: 'buttons', labels: SAMPLE_LABELS });
});

it.each([
  ['an old version', (s: Surface) => void (s.version = '0.9')],
  ['another catalog', (s: Surface) => void (s.createSurface.catalogId = 'https://example.com/catalog.json')],
  ['an extra key', (s: Surface) => void (s.createSurface.sendDataModel = true)],
  ['two choices', (s: Surface) => void s.createSurface.dataModel.o.pop()],
  ['a mention', (s: Surface) => void (s.createSurface.dataModel.o[1] = { t: 'B. @白竜 に頼む' })],
  ['a full-width mention', (s: Surface) => void (s.createSurface.dataModel.o[1] = { t: 'B. ＠白竜 に頼む' })],
  ['a link', (s: Surface) => void (s.createSurface.dataModel.o[0] = { t: 'A. https://example.com を見る' })],
  ['a Markdown link', (s: Surface) => void (s.createSurface.dataModel.o[0] = { t: 'A. [手順書](D:/tools/setup.ps1)' })],
  ['a Markdown image', (s: Surface) => void (s.createSurface.dataModel.o[0] = { t: 'A. ![図](D:/a.png)' })],
  ['a duplicated ID', (s: Surface) => void (s.createSurface.components[2]!.id = 'b')],
  ['a root with another name', (s: Surface) => void (s.createSurface.components[0]!.id = 'top')],
  ['HTML', (s: Surface) => void (s.createSurface.dataModel.o[0] = { t: 'A. <b>太字</b>' })],
  ['a newline', (s: Surface) => void (s.createSurface.dataModel.o[2] = { t: 'C. 止める\n本当に' })],
  ['the wrong order', (s: Surface) => void s.createSurface.dataModel.o.reverse()],
  ['a broken reference', (s: Surface) => void (s.createSurface.components[1]!.child = 'missing')],
  ['another event', (s: Surface) => void (s.createSurface.components[1]!.action = { event: { name: 'go' } })],
  ['an invalid ID', (s: Surface) => void (s.createSurface.components[2]!.id = '1t')],
])('falls back to readable labels for %s', (_name, edit) => {
  const result = read(edited(edit));
  expect(result?.kind).toBe('fallback');
});

it('shows salvaged labels as text when the JSON is out of spec', () => {
  expect(read(edited((s) => void (s.version = '0.9')))).toEqual({
    kind: 'fallback',
    reason: 'unsupported',
    labels: SAMPLE_LABELS,
    raw: expect.stringContaining('"0.9"') as unknown,
  });
});

it('salvages complete labels from broken JSON without guessing the missing ones', () => {
  const cut = PROMPT_SAMPLE.slice(0, PROMPT_SAMPLE.indexOf('{"t":"C.') + 8);
  expect(salvageLabels(cut)).toEqual(SAMPLE_LABELS.slice(0, 2));
  expect(read(proposal(cut))).toMatchObject({ kind: 'fallback', reason: 'partial', labels: SAMPLE_LABELS.slice(0, 2) });
  expect(read(proposal('{"version":"1.0", oops'))).toMatchObject({
    kind: 'fallback',
    reason: 'unreadable',
    labels: [],
  });
});

it('does not make buttons from an unclosed block', () => {
  const content = `どこまで進める？\n\n${fence(PROMPT_SAMPLE, false)}`;
  const view = readChoiceView(message({ content }));
  expect(view.content).toBe('どこまで進める？');
  expect(view.read).toMatchObject({ kind: 'fallback', reason: 'unsupported', labels: SAMPLE_LABELS });
});

it('keeps the body and does not make buttons when there are two blocks', () => {
  const content = proposal(PROMPT_SAMPLE, fence(PROMPT_SAMPLE));
  const view = readChoiceView(message({ content }));
  expect(view.content).toBe(content);
  expect(view.read).toEqual({ kind: 'fallback', reason: 'unreadable', labels: [], raw: null });
});

it('rejects JSON that is too long', () => {
  const long = PROMPT_SAMPLE.replace('"s"', JSON.stringify('s'.repeat(5000)));
  expect(read(proposal(long))?.kind).toBe('fallback');
});

it.each([
  ['progress', { kind: 'progress' as const }],
  ['autonomous', { kind: 'autonomous' as const }],
  ['error', { kind: 'error' as const }],
  ['human', { authorId: HUMAN_ID }],
])('leaves %s messages as plain text', (_name, overrides) => {
  const view = readChoiceView(message(overrides));
  expect(view).toEqual({ content: proposal(), read: null });
});

it('still reads the block when Grok sources or a remaining fence follow it', () => {
  const sources = 'Sources:\n- [例](https://example.com)';
  expect(read(proposal(PROMPT_SAMPLE, sources))?.kind).toBe('buttons');
  const view = readChoiceView(message({ content: proposal(PROMPT_SAMPLE, sources) }));
  expect(view.content).toBe(`どこまで進める？\n\n${sources}`);
});

it('makes only the newest proposal after the latest human message clickable', () => {
  const old = message();
  const latest = message();
  const other = message({ authorId: 'agent-b', content: 'ふつうの発言' });
  const notice = message({ authorId: SYSTEM_ID, kind: 'system', content: 'お知らせ' });
  const progress = message({ kind: 'progress', content: '作業中' });
  expect(findActiveProposal([old, latest, other, notice, progress])).toBe(latest.id);
  expect(findActiveProposal([old, latest, humanMessage()])).toBeNull();
  expect(findActiveProposal([humanMessage(), old])).toBe(old.id);
});

it('does not leave an older proposal clickable when the newest block cannot become buttons', () => {
  const old = message();
  const broken = message({ content: proposal('{oops') });
  const many = message({ content: proposal(PROMPT_SAMPLE, fence(PROMPT_SAMPLE)) });
  expect(findActiveProposal([old, broken])).toBeNull();
  expect(findActiveProposal([old, many])).toBeNull();
  expect(findActiveProposal([old, broken, message({ content: 'ふつうの発言' })])).toBeNull();
  expect(findActiveProposal([broken, old])).toBe(old.id);
});

it('reads the block after removing the tasks block, the same as the screen', () => {
  const tasks = ['```tasks', '@白竜: 調べて', '```'].join('\n');
  const both = message({
    delegationId: 'd',
    content: ['どこまで進める？', '', tasks, '', fence(PROMPT_SAMPLE)].join('\n'),
  });
  expect(findActiveProposal([both])).toBe(both.id);
  expect(readChoiceView(both).read?.kind).toBe('buttons');
  // tasks が閉じていないと、表示では a2ui ごと外れる → 押せる提案にもしない
  const unclosed = ['どこまで進める？', '', '```tasks', '@白竜: 調べて', '', fence(PROMPT_SAMPLE)].join('\n');
  expect(findActiveProposal([message({ delegationId: 'd', content: unclosed })])).toBeNull();
});

it('marks the choice that the next human message sent and leaves other answers unmarked', () => {
  const first = message();
  const second = message();
  const third = message();
  const log = [
    first,
    humanMessage(`@白竜2 ${SAMPLE_LABELS[1]}`),
    second,
    humanMessage('別の答え'),
    message({ content: proposal('{oops') }),
    humanMessage(`@白竜2 ${SAMPLE_LABELS[0]}`),
    third,
  ];
  const answers = findAnswers(log, () => '白竜2');
  expect(answers.get(first.id)).toBe(1);
  expect(answers.get(second.id)).toBeNull();
  expect(answers.has(third.id)).toBe(false);
  expect(answers.size).toBe(2);
  // 今の名前で送られていなければ一致しない
  expect(findAnswers(log, () => '白竜').get(first.id)).toBeNull();
});

const LONE_SURROGATE = String.fromCharCode(0xd800);

it.each([
  ['60 characters', `A. ${'あ'.repeat(57)}`, null],
  ['61 characters', `A. ${'あ'.repeat(58)}`, 'long'],
  ['a leading space', ' A. 調べる', 'blank'],
  ['a trailing space', 'A. 調べる ', 'blank'],
  ['a right-to-left override', 'A. 調べる\u202e', 'control'],
  ['a lone surrogate', `A. 調べる${LONE_SURROGATE}`, 'control'],
  ['www.', 'A. www.example.com', 'markup'],
  ['a Markdown link', 'A. [手順書](D:/tools/setup.ps1) を開く', 'markup'],
  ['a full-width Markdown link', 'A. ［手順書］（D:/a.md）', 'markup'],
  ['a Markdown image', 'A. ![図](D:/a.png)', 'markup'],
  ['brackets only', 'A. [推奨] 調査だけ', null],
  ['a full-width prefix', 'Ａ． 調べる', null],
])('checks a label with %s', (_name, label, problem) => {
  expect(labelProblem(label, 0)).toBe(problem);
});

it('accepts pretty-printed JSON', () => {
  expect(read(proposal(JSON.stringify(sampleSurface(), null, 2)))?.kind).toBe('buttons');
});

it('shows only three labels as text when there are four choices', () => {
  const four = edited((s) => void s.createSurface.dataModel.o.push({ t: 'D. 別の案' }));
  expect(read(four)).toMatchObject({ kind: 'fallback', labels: SAMPLE_LABELS });
});
