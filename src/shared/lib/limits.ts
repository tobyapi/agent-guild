// 契約で決まっている数値の制限（docs/design.md §2・§3）。UI の事前検査とモックの両方が使う。

/** 自発活動の間隔（分）の下限 */
export const AUTONOMY_INTERVAL_MIN = 5;

/** list_delegations が返す割り振りの上限（新しい方から） */
export const DELEGATION_LIST_MAX = 200;

/** 1つの発言に添えられる数と大きさの上限（Rust の guild-domain attachment.rs と同じ） */
export const MAX_ATTACHMENTS = 10;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 30 * 1024 * 1024;
/** 画像としてエージェントに渡す形式（ほかはファイルとしてパスを渡す） */
export const IMAGE_MEDIA_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** list_messages の既定の件数と上限 */
export const MESSAGE_PAGE_SIZE = 50;
export const MESSAGE_PAGE_MAX = 200;

/** チャンネル名・話題の最大文字数（コードポイント。サーバの validation と同じ） */
export const CHANNEL_NAME_MAX = 40;
export const CHANNEL_TOPIC_MAX = 200;

/** チャンネル名の正規化: 前後の空白と先頭の #（全角の ＃ を含む）を除く（サーバと同じ） */
export function cleanChannelName(name: string): string {
  return name.trim().replace(/^[#＃]+/, '').trim();
}
