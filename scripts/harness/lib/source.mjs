// TypeScript の構文木から、import の指定子・stdout と stdin への接触・console の利用を取り出す
// （コメントや文字列に惑わされない）。

import ts from 'typescript';

const STDIO_STREAMS = new Set(['stdin', 'stdout']);

export function parseSource(fileName, text) {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
}

const lineOf = (source, node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** 構文木を全部たどり、pick が返した value を行番号（at か、なければそのノードの行）つきで集める */
function collect(source, pick) {
  const found = [];
  const visit = (node) => {
    const hit = pick(node);
    if (hit !== null) found.push({ ...hit.value, line: lineOf(source, hit.at ?? node) });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** import / export from / 動的 import() / require() / import('x').T の指定子 */
export function collectImports(source) {
  return collect(source, (node) => {
    const literal = moduleSpecifierOf(node);
    return literal ? { value: { specifier: literal.text }, at: literal } : null;
  });
}

const isImportOrRequire = (callee) =>
  callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');

/** import の形ごとに、指定子にあたるノードを取り出す（その形でなければ undefined） */
const SPECIFIER_SOURCES = [
  (node) => (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier : undefined),
  (node) => (ts.isCallExpression(node) && isImportOrRequire(node.expression) ? node.arguments[0] : undefined),
  (node) => (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined),
  (node) =>
    ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      ? node.moduleReference.expression
      : undefined,
];

function moduleSpecifierOf(node) {
  for (const source of SPECIFIER_SOURCES) {
    const specifier = source(node);
    if (specifier !== undefined) return ts.isStringLiteralLike(specifier) ? specifier : null;
  }
  return null;
}

/** process.stdin / process.stdout への接触 */
export function collectStdioUses(source) {
  return collect(source, (node) => {
    const what = streamAccess(node) ?? destructuredStream(node) ?? importedStream(node);
    return what ? { value: { what } } : null;
  });
}

/** console.log・console.error など console のメンバーへの接触（globalThis.console も含む） */
export function collectConsoleUses(source) {
  return collect(source, (node) => {
    if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return null;
    if (!isGlobal(node.expression, 'console')) return null;
    const member = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression.getText();
    return { value: { what: `console.${member}` } };
  });
}

const isNamed = (node, name) => ts.isIdentifier(node) && node.text === name;
/** name そのもの、または globalThis.name */
const isGlobal = (node, name) =>
  isNamed(node, name) ||
  (ts.isPropertyAccessExpression(node) && isNamed(node.expression, 'globalThis') && node.name.text === name);
const isProcess = (node) => isGlobal(node, 'process');

/** process.stdout / process['stdout'] */
function streamAccess(node) {
  if (ts.isPropertyAccessExpression(node) && isProcess(node.expression) && STDIO_STREAMS.has(node.name.text)) {
    return `process.${node.name.text}`;
  }
  if (ts.isElementAccessExpression(node) && isProcess(node.expression)) {
    const key = node.argumentExpression;
    return ts.isStringLiteralLike(key) && STDIO_STREAMS.has(key.text) ? `process.${key.text}` : null;
  }
  return null;
}

/** const { stdout } = process */
function destructuredStream(node) {
  if (!ts.isVariableDeclaration(node) || !ts.isObjectBindingPattern(node.name) || !node.initializer) return null;
  if (!isProcess(node.initializer)) return null;
  const names = node.name.elements.map((element) => (element.propertyName ?? element.name).getText());
  const stream = names.find((name) => STDIO_STREAMS.has(name));
  return stream ? `process.${stream}` : null;
}

/** import { stdout } from 'node:process' */
function importedStream(node) {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return null;
  if (!['process', 'node:process'].includes(node.moduleSpecifier.text)) return null;
  const bindings = node.importClause?.namedBindings;
  const names = bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => (e.propertyName ?? e.name).text) : [];
  const stream = names.find((name) => STDIO_STREAMS.has(name));
  return stream ? `process.${stream}` : null;
}
