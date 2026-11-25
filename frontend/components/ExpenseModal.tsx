'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { todayISO } from '@/lib/format';
import { PAYMENT_METHODS, type Category, type Expense, type ExpenseInput, type PaymentMethod } from '@/lib/types';

interface ExpenseModalProps {
  open: boolean;
  /** null → add mode, an expense → edit mode */
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
  /** Called after save (with the saved expense) or delete (with null) */
  onSaved: (expense: Expense | null) => void;
}

interface FormState {
  amount: string;
  category_id: number | null;
  date: string;
  note: string;
  payment_method: PaymentMethod;
}

const emptyForm = (): FormState => ({
  amount: '',
  category_id: null,
  date: todayISO(),
  note: '',
  payment_method: 'UPI',
});

// Add / Edit expense form shown as a bottom sheet on phones and a dialog on desktop.
export default function ExpenseModal({ open, expense, categories, onClose, onSaved }: ExpenseModalProps) {
  const isEdit = expense !== null;
  const amountRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form every time it opens
  useEffect(() => {
    if (!open) return;
    setForm(
      expense
        ? {
            amount: String(expense.amount),
            category_id: expense.category_id,
            date: expense.date,
            note: expense.note || '',
            payment_method: expense.payment_method || 'UPI',
          }
        : emptyForm()
    );
    setError('');
    setConfirmDelete(false);
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [open, expense]);

  // Close with the Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!(Number(form.amount) > 0)) return setError('Enter an amount more than 0');
    if (!form.category_id) return setError('Pick a category');
    setBusy(true);
    try {
      const body: ExpenseInput = {
        amount: Number(form.amount),
        category_id: form.category_id,
        date: form.date,
        note: form.note,
        payment_method: form.payment_method,
      };
      const saved = isEdit
        ? await api<Expense>(`/api/expenses/${expense.id}`, { method: 'PUT', body })
        : await api<Expense>('/api/expenses', { method: 'POST', body });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!expense) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await api(`/api/expenses/${expense.id}`, { method: 'DELETE' });
      onSaved(null);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit expense' : 'Add expense'}</h2>
          <button type="button" onClick={onClose} className="btn-ghost h-8 w-8 p-0 text-xl" aria-label="Close">
            ×
          </button>
        </div>

        {/* Amount */}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Amount</span>
          <div className="flex items-center rounded-xl border border-slate-300 px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
            <span className="text-2xl font-semibold text-slate-400">₹</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              className="w-full bg-transparent px-2 py-3 text-2xl font-semibold outline-none"
            />
          </div>
        </label>

        {/* Category chips */}
        <div className="mt-4">
          <span className="mb-2 block text-sm font-medium">Category</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = form.category_id === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => set('category_id', c.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    active ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  style={active ? { backgroundColor: c.color } : undefined}
                >
                  <span>{c.icon}</span>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date + payment method */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Date</span>
            <input
              type="date"
              className="input"
              value={form.date}
              max={todayISO()}
              onChange={(e) => set('date', e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Paid by</span>
            <select
              className="input"
              value={form.payment_method}
              onChange={(e) => set('payment_method', e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Note */}
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium">
            Note <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            className="input"
            placeholder="e.g. Lunch with team"
            maxLength={200}
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </label>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex gap-2">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className={`btn ${confirmDelete ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 hover:bg-red-50'}`}
            >
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <button className="btn-primary flex-1 py-3" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
