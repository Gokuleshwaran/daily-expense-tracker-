'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell, { useExpenseUI } from '@/components/AppShell';
import { api, errorMessage } from '@/lib/api';
import { dayLabel, money, monthRange, todayISO, weekRange, type DateRange } from '@/lib/format';
import type { Expense } from '@/lib/types';

type PresetKey = 'week' | 'month' | 'lastMonth' | 'all' | 'custom';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

function rangeForPreset(key: PresetKey): DateRange {
  if (key === 'week') return weekRange();
  if (key === 'month') return monthRange();
  if (key === 'lastMonth') return monthRange(todayISO(), -1);
  return { from: '', to: '' };
}

interface DayGroup {
  date: string;
  items: Expense[];
  total: number;
}

export default function ExpensesPage() {
  return (
    <AppShell title="Expenses">
      <ExpenseList />
    </AppShell>
  );
}

function ExpenseList() {
  const { openEdit, openAdd, version, categories } = useExpenseUI();
  const [preset, setPreset] = useState<PresetKey>('month');
  const [range, setRange] = useState<DateRange>(monthRange());
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Wait 300 ms after typing before searching
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (categoryId) params.set('category_id', categoryId);
    if (debounced) params.set('q', debounced);
    setLoading(true);
    setError('');
    api<Expense[]>(`/api/expenses?${params}`)
      .then(setExpenses)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [range, categoryId, debounced, version]);

  // Group by day, keeping newest first
  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      total: items.reduce((s, e) => s + Number(e.amount), 0),
    }));
  }, [expenses]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      {/* Filters */}
      <div className="card mb-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPreset(p.key);
                if (p.key !== 'custom') setRange(rangeForPreset(p.key));
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                preset === p.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">From</span>
              <input type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">To</span>
              <input type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </label>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 flex items-baseline justify-between px-1">
        <p className="text-sm text-slate-500">
          {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
        </p>
        <p className="text-sm text-slate-500">
          Total <span className="ml-1 text-lg font-bold text-slate-900">{money(total)}</span>
        </p>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && !expenses.length ? (
        <div className="card text-center text-sm text-slate-500">Loading…</div>
      ) : !groups.length ? (
        <div className="card py-10 text-center">
          <p className="text-3xl">🧾</p>
          <p className="mt-2 font-semibold">No expenses here yet</p>
          <p className="mt-1 text-sm text-slate-500">Try another date range, or add your first one.</p>
          <button className="btn-primary mt-4" onClick={openAdd}>
            + Add expense
          </button>
        </div>
      ) : (
        <div className={`space-y-4 transition ${loading ? 'opacity-60' : ''}`}>
          {groups.map((g) => (
            <section key={g.date} className="card p-0">
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-700">{dayLabel(g.date)}</h2>
                <span className="text-sm font-semibold text-slate-700">{money(g.total)}</span>
              </header>
              <ul>
                {g.items.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => openEdit(e)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                        style={{ backgroundColor: `${e.category_color || '#94a3b8'}22` }}
                      >
                        {e.category_icon || '💸'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.note || e.category_name || 'Expense'}</span>
                        <span className="block text-xs text-slate-500">
                          {e.category_name || 'Uncategorised'} · {e.payment_method}
                        </span>
                      </span>
                      <span className="font-semibold">{money(e.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="pt-2 text-center text-xs text-slate-400">Tap an expense to edit or delete it</p>
        </div>
      )}
    </>
  );
}
