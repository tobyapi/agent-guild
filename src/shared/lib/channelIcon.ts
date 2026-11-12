// チャンネルのアイコン（絵文字1つ。空なら # を出す）の規則。正は Rust（guild-domain の channel/icon.rs）で、
// 実例は contracts/behavior/channel-icons.json。画面の事前検査とモックが使う。

/** アイコンの最大バイト数（UTF-8。Rust の CHANNEL_ICON_MAX_BYTES と同じ） */
export const CHANNEL_ICON_MAX_BYTES = 32;

const ZERO_WIDTH_JOINER = 0x200d;

/** アイコンがないときの印 */
export const CHANNEL_HASH = '#';

/**
 * アイコンを正規化する（不正なら null）。前後の空白を除き、空と「#」（全角の ＃ も）は空にする。
 * それ以外は絵文字1つ分で、空白・制御文字・ASCII の英字を含まず、ASCII だけでもないこと
 */
export function normalizeChannelIcon(icon: string): string | null {
  const trimmed = icon.trim();
  if (trimmed === '' || trimmed === '#' || trimmed === '＃') return '';
  return isSingleSymbol(trimmed) ? trimmed : null;
}

/** チャンネルの印: アイコンがあればそれ、なければ # */
export function channelMark(channel: { icon: string }): string {
  return channel.icon === '' ? CHANNEL_HASH : channel.icon;
}

/** 見出し用の「#名前」（アイコンがあれば「🎨 名前」） */
export function channelTitle(channel: { icon: string; name: string }): string {
  return channel.icon === '' ? `${CHANNEL_HASH}${channel.name}` : `${channel.icon} ${channel.name}`;
}

function isSingleSymbol(icon: string): boolean {
  return (
    new TextEncoder().encode(icon).length <= CHANNEL_ICON_MAX_BYTES &&
    // eslint-disable-next-line no-control-regex
    !/^[\x00-\x7f]*$/.test(icon) &&
    !/[\s\p{Cc}A-Za-z]/u.test(icon) &&
    baseCount(icon) === 1
  );
}

/** 基底の文字の数（Rust の base_count と同じ数え方）。ZWJ で終わるなら null */
function baseCount(icon: string): number | null {
  let count = 0;
  let afterJoiner = false;
  let openFlag = false;
  for (const char of icon) {
    const code = char.codePointAt(0) ?? 0;
    if (code === ZERO_WIDTH_JOINER) {
      afterJoiner = true;
      continue;
    }
    if (isExtender(code)) continue;
    if (afterJoiner) {
      afterJoiner = false;
      continue;
    }
    if (isRegionalIndicator(code) && openFlag) {
      openFlag = false;
      continue;
    }
    openFlag = isRegionalIndicator(code);
    count += 1;
  }
  return afterJoiner ? null : count;
}

function isExtender(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    code === 0x20e3 ||
    (code >= 0xfe00 && code <= 0xfe0f) ||
    (code >= 0x1f3fb && code <= 0x1f3ff) ||
    (code >= 0xe0020 && code <= 0xe007f)
  );
}

function isRegionalIndicator(code: number): boolean {
  return code >= 0x1f1e6 && code <= 0x1f1ff;
}
