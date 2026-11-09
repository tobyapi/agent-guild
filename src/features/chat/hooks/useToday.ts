import { useSyncExternalStore } from 'react';
import { startOfDay } from '@/shared/lib/time';

const CHECK_MS = 60_000;

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, CHECK_MS);
  return () => clearInterval(timer);
}

function today(): number {
  return startOfDay(Date.now());
}

/** 今日の 0:00（日付の区切りの「今日」「昨日」に使う。日付が変わると更新される） */
export function useToday(): number {
  return useSyncExternalStore(subscribe, today);
}
