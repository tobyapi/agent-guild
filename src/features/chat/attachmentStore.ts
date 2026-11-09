// 発言に添えられた画像の中身（data URL）の取得とキャッシュ（同じ画像は1回だけ取る）と、ファイルのファイラでの表示。
// 送った直後の画像は、入力欄のプレビューをそのまま使う（取り直さない）。
import { chatApi } from './api';

const loaded = new Map<string, string>();
const loading = new Map<string, Promise<string>>();

/** 取得済みなら data URL */
export const cachedAttachment = (attachmentId: string): string | undefined => loaded.get(attachmentId);

/** 送った画像の data URL を先に入れておく */
export function primeAttachment(attachmentId: string, dataUrl: string): void {
  loaded.set(attachmentId, dataUrl);
}

/** 発言に添えたファイルを OS のファイラで表示する */
export function revealAttachment(messageId: string, attachmentId: string): Promise<null> {
  return chatApi.reveal(messageId, attachmentId);
}

/** 画像の data URL（取得中のものは同じ取得を待つ） */
export function loadAttachment(messageId: string, attachmentId: string): Promise<string> {
  const ready = loaded.get(attachmentId);
  if (ready !== undefined) return Promise.resolve(ready);
  const pending =
    loading.get(attachmentId) ??
    chatApi
      .attachment(messageId, attachmentId)
      .then((dataUrl) => {
        loaded.set(attachmentId, dataUrl);
        return dataUrl;
      })
      .finally(() => loading.delete(attachmentId));
  loading.set(attachmentId, pending);
  return pending;
}
