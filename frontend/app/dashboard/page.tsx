'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppShell, { useExpenseUI } from '@/components/AppShell';
import { api, errorMessage } from '@/lib/api';
import { addDays, dayLabel, fromISODate, money, monthRange, todayISO } from '@/lib/format';
import type { Budget, CategoryTotal, Dashboard as DashboardData, DayTotal, Expense, Period, TopExpense } from '@/lib/types';

const BRAND = '#4f46e5';
const BRAND_SOFT = '#c7d2fe';
const GRID = '#e2e8f0';
const AXIS = '#64748b';

export default function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

// ---------- helpers ----------
const short = (n: number): string => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${n}`);

function periodLabel(period: Period, from: string, to: string): string {
  const f = fromISODate(from);
  const t = fromISODate(to);
  if (period === 'month') return f.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const sameMonth = f.getMonth() === t.getMonth();
  const left = f.toLocaleDateString('en-IN', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const right = t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${left} – ${right}`;
}

function shiftDate(period: Period, date: string, dir: number): string {
  if (period === 'week') return addDays(date, 7 * dir);
  return monthRange(date, dir).from;
}

// ---------- page ----------
function Dashboard() {
  const { version, openEdit } = useExpenseUI();
  const [period, setPeriod] = useState<Period>('week');
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [budgetTick, setBudgetTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError('');
    api<DashboardData>(`/api/dashboard?period=${period}&date=${date}&today=${todayISO()}`)
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [period, date, version, budgetTick]);

  const isCurrent = data ? todayISO() >= data.from && todayISO() <= data.to : true;
  const prevWord = period === 'week' ? 'last week' : 'last month';

  return (
    <>
      {/* Header: title, Week/Month toggle, period arrows */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex rounded-xl bg-slate-200/70 p-1">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                setDate(todayISO());
              }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${
                period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <button className="btn-ghost h-9 w-9 p-0 text-lg" onClick={() => setDate(shiftDate(period, date, -1))} aria-label="Previous period">
          ‹
        </button>
        <div className="text-center">
          <p className="font-semibold">{data ? periodLabel(period, data.from, data.to) : '…'}</p>
          {!isCurrent && (
            <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setDate(todayISO())}>
              Back to this {period}
            </button>
          )}
        </div>
        <button
          className="btn-ghost h-9 w-9 p-0 text-lg"
          onClick={() => setDate(shiftDate(period, date, 1))}
          disabled={isCurrent}
          aria-label="Next period"
        >
          ›
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!data ? (
        <div className="card text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className={`space-y-5 transition ${loading ? 'opacity-60' : ''}`}>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card col-span-2 lg:col-span-1">
              <p className="text-sm text-slate-500">Total spent</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">{money(data.total)}</p>
              <Change pct={data.changePct} prevTotal={data.prevTotal} prevWord={prevWord} />
            </div>
            <Stat label="Daily average" value={money(data.dailyAverage)} sub={isCurrent ? 'so far' : 'for the period'} />
            <Stat label="Expenses" value={data.count} sub={data.count === 1 ? 'entry' : 'entries'} />
            {period === 'month' ? (
              <BudgetTile budget={data.budget ?? null} onSaved={() => setBudgetTick((t) => t + 1)} />
            ) : (
              <Stat
                label="Top category"
                value={data.byCategory[0] ? `${data.byCategory[0].icon} ${data.byCategory[0].name}` : '—'}
                sub={data.byCategory[0] ? `${money(data.byCategory[0].total)} · ${data.byCategory[0].pct}% of spending` : 'no spending yet'}
                className="col-span-2 lg:col-span-1"
              />
            )}
          </div>

          {data.count === 0 ? (
            <div className="card py-10 text-center">
              <p className="text-3xl">📊</p>
              <p className="mt-2 font-semibold">No spending recorded for this {period}</p>
              <p className="mt-1 text-sm text-slate-500">Use the + Add expense button and your charts will fill in.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-5">
                <DailyChart period={period} byDay={data.byDay} />
                <CategoryBreakdown items={data.byCategory} />
              </div>
              <div className="grid gap-5 lg:grid-cols-5">
                <TopExpenses items={data.top} onOpen={openEdit} />
                {period === 'month' && data.trend && <TrendChart trend={data.trend} current={data.from.slice(0, 7)} />}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ---------- pieces ----------
interface StatProps {
  label: string;
  value: ReactNode;
  sub?: string;
  className?: string;
}

function Stat({ label, value, sub, className = '' }: StatProps) {
  return (
    <div className={`card ${className}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Change({ pct, prevTotal, prevWord }: { pct: number | null; prevTotal: number; prevWord: string }) {
  if (pct === null) {
    return <p className="mt-1 text-xs text-slate-400">{prevTotal ? '' : `Nothing recorded ${prevWord}`}</p>;
  }
  const up = pct > 0;
  const same = pct === 0;
  // Spending more is shown as a warning (red), spending less as good (green)
  const tone = same ? 'bg-slate-100 text-slate-600' : up ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700';
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>
        {same ? '= 0%' : `${up ? '▲' : '▼'} ${Math.abs(pct)}%`}
      </span>
      vs {prevWord} ({money(prevTotal)})
    </p>
  );
}

function BudgetTile({ budget, onSaved }: { budget: Budget | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/budget', { method: 'PUT', body: { monthly_budget: value === '' ? null : Number(value) } });
      setEditing(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="card col-span-2 space-y-2 lg:col-span-1">
        <p className="text-sm text-slate-500">Monthly budget</p>
        <input
          className="input"
          type="number"
          min="0"
          inputMode="numeric"
          placeholder="e.g. 20000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button className="btn-primary flex-1 py-1.5" disabled={busy}>Save</button>
          <button type="button" className="btn-ghost py-1.5" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    );
  }

  if (!budget) {
    return (
      <div className="card col-span-2 flex flex-col justify-between lg:col-span-1">
        <p className="text-sm text-slate-500">Monthly budget</p>
        <button className="btn mt-2 border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50" onClick={() => setEditing(true)}>
          + Set a budget
        </button>
      </div>
    );
  }

  const over = budget.left < 0;
  const pct = Math.min(100, budget.pct || 0);
  const bar = over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-600';
  return (
    <div className="card col-span-2 lg:col-span-1">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{over ? 'Over budget by' : 'Budget left'}</p>
        <button
          className="text-xs font-medium text-brand-600 hover:underline"
          onClick={() => {
            setValue(String(budget.amount));
            setEditing(true);
          }}
        >
          Edit
        </button>
      </div>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${over ? 'text-red-600' : ''}`}>{money(Math.abs(budget.left))}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {budget.pct}% of {money(budget.amount)} used{over ? ' ⚠' : ''}
      </p>
    </div>
  );
}

interface ChartRow {
  total: number;
  date?: string;
  full?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  labelFor: (row: ChartRow) => string;
}

// Recharts injects `active` and `payload` when it renders the tooltip
function ChartTooltip({ active, payload, labelFor }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-slate-500">{labelFor(p)}</p>
      <p className="text-sm font-semibold text-slate-900">{money(p.total)}</p>
    </div>
  );
}

function DailyChart({ period, byDay }: { period: Period; byDay: DayTotal[] }) {
  const today = todayISO();
  const rows = byDay.map((d) => ({
    ...d,
    label:
      period === 'week'
        ? fromISODate(d.date).toLocaleDateString('en-IN', { weekday: 'short' })
        : String(fromISODate(d.date).getDate()),
  }));
  const peak = rows.reduce((m, r) => (r.total > m.total ? r : m), rows[0]);

  return (
    <section className="card lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold">Spending by day</h2>
        {peak.total > 0 && (
          <p className="text-xs text-slate-500">
            Highest: <span className="font-semibold text-slate-700">{dayLabel(peak.date)}</span> · {money(peak.total)}
          </p>
        )}
      </div>
      <div className="h-56 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap={period === 'week' ? '30%' : '15%'}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: AXIS, fontSize: 12 }}
              interval={period === 'week' ? 0 : 'preserveStartEnd'}
              minTickGap={8}
            />
            <YAxis tickFormatter={short} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={52} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTooltip labelFor={(p) => dayLabel(p.date ?? '')} />} />
            <Bar dataKey="total" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={44}>
              {rows.map((r) => (
                <Cell key={r.date} fill={r.date > today ? BRAND_SOFT : BRAND} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CategoryBreakdown({ items }: { items: CategoryTotal[] }) {
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <section className="card lg:col-span-2">
      <h2 className="mb-4 font-semibold">Where it went</h2>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.name}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span>{c.icon}</span>
                <span className="truncate font-medium">{c.name}</span>
              </span>
              <span className="shrink-0">
                <span className="font-semibold">{money(c.total)}</span>
                <span className="ml-2 inline-block w-11 text-right text-xs text-slate-500">{c.pct}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(c.total / max) * 100}%`, backgroundColor: c.color }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopExpenses({ items, onOpen }: { items: TopExpense[]; onOpen: (expense: Expense) => void }) {
  return (
    <section className="card p-0 lg:col-span-2">
      <h2 className="px-5 pb-2 pt-5 font-semibold">Top expenses</h2>
      <ol>
        {items.map((e, i) => (
          <li key={e.id}>
            <button
              onClick={() => api<Expense[]>(`/api/expenses?from=${e.date}&to=${e.date}`).then((list) => {
                const full = list.find((x) => x.id === e.id);
                if (full) onOpen(full);
              })}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-50"
            >
              <span className="w-4 text-xs font-semibold text-slate-400">{i + 1}</span>
              <span className="text-lg">{e.category_icon || '💸'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.note || e.category_name}</span>
                <span className="block text-xs text-slate-500">
                  {e.category_name} · {dayLabel(e.date)}
                </span>
              </span>
              <span className="text-sm font-semibold">{money(e.amount)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="h-3" />
    </section>
  );
}

function TrendChart({ trend, current }: { trend: { month: string; total: number }[]; current: string }) {
  const rows = trend.map((t) => {
    const [y, m] = t.month.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return { ...t, label: d.toLocaleDateString('en-IN', { month: 'short' }), full: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
  });
  return (
    <section className="card lg:col-span-3">
      <h2 className="mb-4 font-semibold">Last 6 months</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} />
            <YAxis tickFormatter={short} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={52} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} content={<ChartTooltip labelFor={(p) => p.full ?? ''} />} />
            <Bar dataKey="total" isAnimationActive={false} radius={[4, 4, 0, 0]} maxBarSize={48}>
              {rows.map((r) => (
                <Cell key={r.month} fill={r.month === current ? BRAND : BRAND_SOFT} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">Dark bar = the month you're viewing</p>
    </section>
  );
}
