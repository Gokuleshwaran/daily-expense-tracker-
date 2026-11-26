import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  dayLabel,
  fromISODate,
  money,
  monthRange,
  todayISO,
  toISODate,
  weekRange,
} from '@/lib/format';

afterEach(() => {
  vi.useRealTimers();
});

// Local-time "now" (the helpers all work in the user's local time zone)
const setToday = (y: number, m: number, d: number) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(y, m - 1, d, 12, 0, 0));
};

describe('money', () => {
  it('formats rupees with two decimals', () => {
    expect(money(250)).toBe('₹250.00');
    expect(money(1234.5)).toBe('₹1,234.50');
  });

  it('uses Indian digit grouping (lakhs and crores)', () => {
    expect(money(100000)).toBe('₹1,00,000.00');
    expect(money(1234567)).toBe('₹12,34,567.00');
  });

  it('accepts numeric strings', () => {
    expect(money('99.9')).toBe('₹99.90');
  });

  it.each([[null], [undefined], ['abc'], [NaN]])('shows ₹0.00 for %j', (value) => {
    expect(money(value as number)).toBe('₹0.00');
  });

  it('formats negative amounts', () => {
    expect(money(-500)).toContain('500.00');
    expect(money(-500)).toContain('-');
  });
});

describe('toISODate / fromISODate', () => {
  it('zero-pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('round-trips without shifting the day', () => {
    for (const s of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31', '2028-02-29']) {
      expect(toISODate(fromISODate(s))).toBe(s);
    }
  });

  it('parses as a local date', () => {
    const d = fromISODate('2026-11-05');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 5]);
  });
});

describe('todayISO', () => {
  it("returns the user's local date", () => {
    setToday(2026, 3, 7);
    expect(todayISO()).toBe('2026-03-07');
  });
});

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2026-11-25', 1)).toBe('2026-11-26');
    expect(addDays('2026-11-25', -5)).toBe('2026-11-20');
    expect(addDays('2026-11-25', 0)).toBe('2026-11-25');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('knows about leap years', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('moves a whole week', () => {
    expect(addDays('2026-11-25', 7)).toBe('2026-12-02');
  });
});

describe('weekRange (Monday to Sunday)', () => {
  it.each([
    ['2026-11-23', 'Monday'],
    ['2026-11-25', 'Wednesday'],
    ['2026-11-29', 'Sunday'],
  ])('%s (%s) is in the week 2026-11-23 to 2026-11-29', (date) => {
    expect(weekRange(date)).toEqual({ from: '2026-11-23', to: '2026-11-29' });
  });

  it('starts the next week on the following Monday', () => {
    expect(weekRange('2026-11-30')).toEqual({ from: '2026-11-30', to: '2026-12-06' });
  });

  it('can span two months or two years', () => {
    expect(weekRange('2026-12-31')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
  });

  it('defaults to the current week', () => {
    setToday(2026, 11, 25);
    expect(weekRange()).toEqual({ from: '2026-11-23', to: '2026-11-29' });
  });
});

describe('monthRange', () => {
  it('returns the first and last day of the month', () => {
    expect(monthRange('2026-11-15')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2026-12-01')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('handles February in normal and leap years', () => {
    expect(monthRange('2026-02-10').to).toBe('2026-02-28');
    expect(monthRange('2028-02-10').to).toBe('2028-02-29');
  });

  it('supports negative and positive month offsets', () => {
    expect(monthRange('2026-11-15', -1)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2026-11-15', 1)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('rolls over year boundaries', () => {
    expect(monthRange('2026-01-10', -1)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(monthRange('2026-12-10', 1)).toEqual({ from: '2027-01-01', to: '2027-01-31' });
  });

  it('defaults to the current month', () => {
    setToday(2026, 11, 25);
    expect(monthRange()).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
});

describe('dayLabel', () => {
  it("says 'Today' and 'Yesterday'", () => {
    setToday(2026, 11, 25);
    expect(dayLabel('2026-11-25')).toBe('Today');
    expect(dayLabel('2026-11-24')).toBe('Yesterday');
  });

  it("handles 'Yesterday' across a month boundary", () => {
    setToday(2026, 12, 1);
    expect(dayLabel('2026-11-30')).toBe('Yesterday');
  });

  it('spells out any other date with weekday, day, month and year', () => {
    setToday(2026, 11, 25);
    const label = dayLabel('2026-11-21');
    expect(label).toContain('Sat');
    expect(label).toContain('21');
    expect(label).toContain('Nov');
    expect(label).toContain('2026');
  });

  it("does not call tomorrow 'Today'", () => {
    setToday(2026, 11, 25);
    expect(dayLabel('2026-11-26')).not.toBe('Today');
  });
});
