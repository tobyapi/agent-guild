// アプリの外（OS の既定のブラウザ）で開いてよいリンクの判定。サーバの open_url と同じ規則（http・https だけ）。

const EXTERNAL_URL = /^https?:\/\/[^/\s]/i;

/** http:// か https:// で始まり、ホストがあり、空白や制御文字を含まない */
export function isExternalUrl(url: string): boolean {
  return EXTERNAL_URL.test(url) && !/[\s\p{Cc}]/u.test(url);
}
