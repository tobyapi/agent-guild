import { useCallback, useState } from 'react';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/**
 * 検証エラーの出し方（docs/ui-design.md §5.10）: 初回は入力欄を離れたときか送信したときに出し、
 * 以後は打つたびに更新する（打ち始めから赤くしない）。
 */
export function useFieldErrors<K extends string>(errors: FieldErrors<K>) {
  const [touched, setTouched] = useState<ReadonlySet<K>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);

  const touch = useCallback((key: K) => {
    setTouched((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));
  }, []);
  const markSubmitted = useCallback(() => setSubmitted(true), []);

  const visible: FieldErrors<K> = submitted
    ? errors
    : (Object.fromEntries(Object.entries(errors).filter(([key]) => touched.has(key as K))) as FieldErrors<K>);

  return { visible, touch, markSubmitted };
}

/** エラーがひとつでもあるか */
export function hasErrors<K extends string>(errors: FieldErrors<K>): boolean {
  return Object.values(errors).some((message) => typeof message === 'string' && message !== '');
}
