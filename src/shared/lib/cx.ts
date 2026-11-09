/** className を空白区切りで結合する。偽値（条件つきクラスの false など）は捨てる */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
