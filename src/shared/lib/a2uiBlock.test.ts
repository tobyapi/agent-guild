import { expect, it } from 'vitest';
import { findA2uiBlock, removeA2uiBlock } from './a2uiBlock';

const json = '{"version":"1.0"}';

it('finds one closed top-level block and removes it for display', () => {
  const content = `質問？\n\n\`\`\`a2ui\n${json}\n\`\`\`\n\n続き`;
  const found = findA2uiBlock(content);
  expect(found).toEqual({ kind: 'one', block: { body: json, start: 2, end: 5, closed: true } });
  if (found.kind !== 'one') throw new Error('not found');
  expect(removeA2uiBlock(content, found.block)).toBe('質問？\n\n続き');
});

it('accepts case and spaces in the opening line, and CRLF', () => {
  const found = findA2uiBlock(`質問\r\n\`\`\` A2UI \r\n${json}\r\n\`\`\``);
  expect(found.kind === 'one' && found.block.body).toBe(json);
});

it('reports an unclosed block as running to the end', () => {
  const found = findA2uiBlock(`質問\n\`\`\`a2ui\n${json}\nあと`);
  expect(found).toEqual({ kind: 'one', block: { body: `${json}\nあと`, start: 1, end: 4, closed: false } });
});

it('reports two top-level blocks as many', () => {
  expect(findA2uiBlock(`\`\`\`a2ui\n${json}\n\`\`\`\n\n\`\`\`a2ui\n${json}\n\`\`\``)).toEqual({ kind: 'many' });
});

it.each([
  ['inside another code block', `\`\`\`text\n\`\`\`a2ui\n${json}\n\`\`\``],
  ['inside a quote', `> \`\`\`a2ui\n> ${json}\n> \`\`\``],
  ['with no block', '質問だけ'],
  ['with another language', `\`\`\`a2ui-x\n${json}\n\`\`\``],
])('ignores blocks %s', (_name, content) => {
  expect(findA2uiBlock(content)).toEqual({ kind: 'none' });
});

it('finds the block after a tasks block and before notify / skill-usage', () => {
  const content = [
    '質問',
    '```tasks',
    '@ハル: 調べて',
    '```',
    '```a2ui',
    json,
    '```',
    '',
    '```notify',
    '通知',
    '```',
  ].join('\n');
  const found = findA2uiBlock(content);
  expect(found.kind === 'one' && found.block.start).toBe(4);
});
