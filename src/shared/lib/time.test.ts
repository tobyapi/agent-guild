import { describe, expect, it } from 'vitest';
import { formatDayLabel, isSameDay, startOfDay } from './time';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();

describe('startOfDay / isSameDay', () => {
  it('同じ日の別の時刻は同じ日とみなす', () => {
    expect(startOfDay(at(8, 23, 59))).toBe(at(8, 0));
    expect(isSameDay(at(8, 0, 1), at(8, 23, 59))).toBe(true);
    expect(isSameDay(at(8, 23, 59), at(9, 0, 0))).toBe(false);
  });
});

describe('formatDayLabel', () => {
  const today = at(8, 12);

  it('今日と昨日は言葉で表す', () => {
    expect(formatDayLabel(at(8, 1), today)).toBe('今日');
    expect(formatDayLabel(at(7, 23), today)).toBe('昨日');
  });

  it('それより前は日付を表示する', () => {
    const label = formatDayLabel(at(1, 9), today);
    expect(label).toContain('11月1日');
    expect(label).toContain('2026');
  });
});
