// a2ui ブロックの検証: AIギルドが受け付けるのは、指示文の見本と同じ形の A2UI v1.0 createSurface だけ。
// Basic Catalog の Row が、Button テンプレート（子は Text）を dataModel.o の3件へ展開する形（docs/design.md §7.2）。
// 部品 ID は見本と違ってもよいが、字種・重複・参照は確かめる。通らなければボタンを作らない。

export const A2UI_VERSION = '1.0';
export const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
export const CHOICE_EVENT = 'pick';
/** 見本の JSON 本体は約430字。これより大きいものは読まない */
export const A2UI_MAX_LENGTH = 4000;
export const CHOICE_COUNT = 3;
export const CHOICE_LABEL_MAX = 60;
const PREFIXES = ['A.', 'B.', 'C.'];
const ID_PATTERN = /^[\p{XID_Start}_]\p{XID_Continue}*$/u;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** キーがちょうど keys であるオブジェクト（足りない・余分なキーは不可） */
function hasKeys(value: unknown, keys: readonly string[]): value is Json {
  if (!isObject(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

/** ラベルの問題（なければ null）。メンション（＠も）・リンク・HTML・改行・制御文字は不可 */
export function labelProblem(label: string, index: number): string | null {
  const normalized = label.normalize('NFKC');
  if (label.trim() !== label || label === '') return 'blank';
  if (Array.from(label).length > CHOICE_LABEL_MAX) return 'long';
  if (!normalized.startsWith(PREFIXES[index] ?? '\u0000')) return 'prefix';
  if (normalized.includes('@')) return 'mention';
  // Markdown のリンク・画像（`](`）は、押したあとの人間の発言でローカルリンクになるので弾く。`[推奨]` だけなら通す
  if (/[<>`]/.test(normalized) || /https?:|www\.|\]\s*\(/i.test(normalized)) return 'markup';
  if (/\p{Cc}|\p{Cf}|\p{Zl}|\p{Zp}|\p{Cs}/u.test(label)) return 'control';
  return null;
}

/** dataModel.o の3件のラベル。形が違えば null */
function readLabels(dataModel: unknown): string[] | null {
  if (!hasKeys(dataModel, ['o']) || !Array.isArray(dataModel.o) || dataModel.o.length !== CHOICE_COUNT) return null;
  const labels = dataModel.o.map((item: unknown) =>
    hasKeys(item, ['t']) && typeof item.t === 'string' ? item.t : null,
  );
  return labels.every((label): label is string => label !== null) ? labels : null;
}

/** 部品を ID で引く表。ID の字種が違う・重複している・形が違えば null */
function componentsById(components: unknown): Map<string, Json> | null {
  if (!Array.isArray(components) || components.length !== 3) return null;
  const byId = new Map<string, Json>();
  for (const component of components) {
    if (!isObject(component) || typeof component.id !== 'string' || !ID_PATTERN.test(component.id)) return null;
    if (byId.has(component.id)) return null;
    byId.set(component.id, component);
  }
  return byId;
}

/** id で引いた部品が、キーがちょうど keys で種類が kind なら返す */
function component(byId: Map<string, Json>, id: unknown, kind: string, keys: readonly string[]): Json | null {
  const found = typeof id === 'string' ? byId.get(id) : undefined;
  return hasKeys(found, ['id', 'component', ...keys]) && found.component === kind ? found : null;
}

/** Row の children が /o を展開するテンプレートなら、その部品の ID */
function templateId(root: Json): unknown {
  const children = root.children;
  return hasKeys(children, ['componentId', 'path']) && children.path === '/o' ? children.componentId : null;
}

const isPickAction = (action: unknown) =>
  hasKeys(action, ['event']) && hasKeys(action.event, ['name']) && action.event.name === CHOICE_EVENT;

const isLabelText = (text: Json) => hasKeys(text.text, ['@path']) && text.text['@path'] === 't';

/** root（Row）→ テンプレートの Button → 子の Text の参照がそろっているか（3つは別の部品） */
function hasChoiceTree(byId: Map<string, Json>): boolean {
  const root = component(byId, 'root', 'Row', ['children']);
  const button = root && component(byId, templateId(root), 'Button', ['child', 'action']);
  const text = button && component(byId, button.child, 'Text', ['text']);
  if (!root || !button || !text) return false;
  return isPickAction(button.action) && isLabelText(text) && new Set([root.id, button.id, text.id]).size === 3;
}

/** 読み取った JSON が見本の形なら3つのラベル、違えば null */
export function readChoiceSurface(value: unknown): string[] | null {
  if (!hasKeys(value, ['version', 'createSurface']) || value.version !== A2UI_VERSION) return null;
  const surface = value.createSurface;
  if (!hasKeys(surface, ['surfaceId', 'catalogId', 'dataModel', 'components'])) return null;
  if (typeof surface.surfaceId !== 'string' || surface.surfaceId === '' || surface.catalogId !== BASIC_CATALOG_ID) {
    return null;
  }
  const byId = componentsById(surface.components);
  const labels = readLabels(surface.dataModel);
  if (!byId || !labels || !hasChoiceTree(byId)) return null;
  return labels.every((label, index) => labelProblem(label, index) === null) ? labels : null;
}

export type JsonRead = { ok: true; value: unknown } | { ok: false };

/** 長さを制限して JSON を読む */
export function readJson(body: string): JsonRead {
  if (body.length > A2UI_MAX_LENGTH) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false };
  }
}
