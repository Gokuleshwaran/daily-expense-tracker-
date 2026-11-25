'use client';

import { useState, type FormEvent } from 'react';
import AppShell, { useExpenseUI } from '@/components/AppShell';
import { API_URL, api, errorMessage, getToken } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { money, todayISO } from '@/lib/format';

const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#10b981', '#eab308', '#64748b', '#14b8a6', '#6366f1'];
const ICONS = ['🍔', '🚌', '🏠', '🧾', '🛍️', '💊', '🎬', '💸', '☕', '🎓', '✈️', '🎁', '🐶', '💪', '📱', '⛽'];

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="space-y-5">
        <AccountCard />
        <BudgetCard />
        <CategoriesCard />
        <ExportCard />
      </div>
    </AppShell>
  );
}

function Message({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>;
  return null;
}

// ---------- Account ----------
function AccountCard() {
  const user = useUser();
  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Account</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Name</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="truncate font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Currency</dt>
          <dd className="font-medium">{user.currency} (₹)</dd>
        </div>
      </dl>
    </section>
  );
}

// ---------- Monthly budget ----------
function BudgetCard() {
  const user = useUser();
  const { setUser } = useAuth();
  const [value, setValue] = useState(user.monthly_budget != null ? String(user.monthly_budget) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setOk('');
    setBusy(true);
    try {
      const { monthly_budget } = await api<{ monthly_budget: number | null }>('/api/budget', {
        method: 'PUT',
        body: { monthly_budget: value === '' ? null : Number(value) },
      });
      setUser({ ...user, monthly_budget });
      setOk(monthly_budget == null ? 'Budget cleared' : `Budget set to ${money(monthly_budget)} per month`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Monthly budget</h2>
      <p className="mb-3 mt-1 text-sm text-slate-500">Shown as a progress bar on your monthly dashboard. Leave empty for no budget.</p>
      <form onSubmit={save} className="space-y-3">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-slate-300 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
            <span className="text-slate-400">₹</span>
            <input
              className="w-full bg-transparent px-2 py-2 text-sm outline-none"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="e.g. 20000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
        <Message error={error} ok={ok} />
      </form>
    </section>
  );
}

// ---------- Categories ----------
function CategoriesCard() {
  const { categories, refreshCategories } = useExpenseUI();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[8]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/categories', { method: 'POST', body: { name, icon, color } });
      setName('');
      await refreshCategories();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (confirmId !== id) return setConfirmId(id);
    setError('');
    try {
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      setConfirmId(null);
      await refreshCategories();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const custom = categories.filter((c) => !c.is_default);
  const defaults = categories.filter((c) => c.is_default);

  return (
    <section className="card">
      <h2 className="font-semibold">Categories</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Add your own categories. Deleting one keeps its expenses, they just become “Uncategorised”.
      </p>

      <ul className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {[...defaults, ...custom].map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg text-lg" style={{ backgroundColor: `${c.color}22` }}>
              {c.icon}
            </span>
            <span className="flex-1 text-sm font-medium">{c.name}</span>
            {c.is_default ? (
              <span className="text-xs text-slate-400">Default</span>
            ) : (
              <button
                onClick={() => remove(c.id)}
                onBlur={() => setConfirmId(null)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  confirmId === c.id ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50'
                }`}
              >
                {confirmId === c.id ? 'Tap again to delete' : 'Delete'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-3 rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-medium">New category</p>
        <input
          className="input"
          placeholder="e.g. Groceries"
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Icon</p>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIcon(i)}
                className={`h-9 w-9 rounded-lg text-lg ${icon === i ? 'bg-brand-600/10 ring-2 ring-brand-600' : 'bg-white ring-1 ring-slate-200'}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-slate-500">Colour</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                className={`h-7 w-7 rounded-full ${color === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <Message error={error} />
        <button className="btn-primary" disabled={busy || !name.trim()}>{busy ? 'Adding…' : 'Add category'}</button>
      </form>
    </section>
  );
}

// ---------- CSV export ----------
function ExportCard() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The export route needs the login header, so fetch it and save the result as a file
  async function download() {
    setError('');
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`${API_URL}/api/expenses/export.csv?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${from || 'start'}_${to || 'today'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Export expenses</h2>
      <p className="mb-3 mt-1 text-sm text-slate-500">Download your expenses as a CSV file you can open in Excel or Google Sheets.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">From <span className="font-normal text-slate-400">(optional)</span></span>
          <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">To</span>
          <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 space-y-3">
        <Message error={error} />
        <button className="btn-primary" onClick={download} disabled={busy}>
          {busy ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>
    </section>
  );
}
