import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { HUMAN_ID } from '@/shared/types/domain';
import type { Message } from '@/shared/types/domain';

/** 下端からこの距離以内なら「下端にいる」とみなし、新着に追従する */
const STICK_PX = 48;
/** 上端からこの距離以内に来たら過去のページを読む */
const LOAD_PX = 160;

interface Options {
  scrollerRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  channelId: string;
  messages: readonly Message[];
  canLoadOlder: boolean;
  onLoadOlder: () => void;
}

/**
 * メッセージ一覧のスクロール（docs/ui-design.md §5.4）:
 * 下端にいるときだけ新着に追従し、自分の発言では必ず下端へ。上端に近づいたら過去のページを読み、見ていた位置を保つ。
 * 上にいるあいだに新着が来たら「新しいメッセージ」を出す。
 */
export function useMessageScroll({ scrollerRef, contentRef, channelId, messages, canLoadOlder, onLoadOlder }: Options) {
  const stick = useRef(true);
  const anchor = useRef<{ firstId: string | undefined; fromBottom: number } | null>(null);
  const lastSeen = useRef(0);
  const lastSeq = messages.at(-1)?.seq ?? 0;
  const [atBottom, setAtBottom] = useState(true);
  const [seenSeq, setSeenSeq] = useState(lastSeq);

  useLayoutEffect(() => {
    stick.current = true;
    anchor.current = null;
  }, [channelId]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const last = messages.at(-1);
    const ownNew = last?.authorId === HUMAN_ID && last.seq > lastSeen.current;
    lastSeen.current = last?.seq ?? 0;
    if (!scroller) return;
    const pending = anchor.current;
    if (pending && pending.firstId !== messages[0]?.id) {
      scroller.scrollTop = scroller.scrollHeight - pending.fromBottom;
      anchor.current = null;
    } else if (stick.current || ownNew) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages, scrollerRef]);

  // 中身の高さ（画像・フォントの読み込み）や一覧の高さ（動作中表示の出入り）が変わっても、下端にいれば追従する
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (stick.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollerRef, contentRef]);

  const requestOlder = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !canLoadOlder) return;
    anchor.current = { firstId: messages[0]?.id, fromBottom: scroller.scrollHeight - scroller.scrollTop };
    onLoadOlder();
  }, [canLoadOlder, messages, onLoadOlder, scrollerRef]);

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const bottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_PX;
    stick.current = bottom;
    setAtBottom(bottom);
    if (bottom) setSeenSeq(lastSeq);
    if (scroller.scrollTop < LOAD_PX) requestOlder();
  }, [lastSeq, requestOlder, scrollerRef]);

  const jumpToBottom = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight });
  }, [scrollerRef]);

  return { onScroll, requestOlder, jumpToBottom, showJump: !atBottom && lastSeq > seenSeq };
}
