// Formatting and date helpers shared across pages

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const money = (n: number | string | null | undefined): string => inr.format(Number(n) || 0);

const pad = (n: number): string => String(n).padStart(2, '0');

// 'YYYY-MM-DD' for a JS Date in the user's local time zone
export const toISODate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = (): string => toISODate(new Date());

// Parse 'YYYY-MM-DD' as a local date (no time zone shift)
export const fromISODate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: string, n: number): string => {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export interface DateRange {
  from: string;
  to: string;
}

// Monday-based week containing the date
export const weekRange = (s: string = todayISO()): DateRange => {
  const d = fromISODate(s);
  const dow = (d.getDay() + 6) % 7;
  const from = addDays(s, -dow);
  return { from, to: addDays(from, 6) };
};

export const monthRange = (s: string = todayISO(), offset = 0): DateRange => {
  const d = fromISODate(s);
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  return { from: toISODate(first), to: toISODate(last) };
};

// 'Today', 'Yesterday' or e.g. 'Sat, 21 Nov 2026'
export const dayLabel = (s: string): string => {
  const today = todayISO();
  if (s === today) return 'Today';
  if (s === addDays(today, -1)) return 'Yesterday';
  return fromISODate(s).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};
