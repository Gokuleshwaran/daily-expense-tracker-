'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Nav from './Nav';
import ExpenseModal from './ExpenseModal';
import { useRequireAuth } from '@/lib/auth';
import { api } from '@/lib/api';

// Lets any page open the Add / Edit form and know when data changed
const ExpenseUIContext = createContext(null);
export const useExpenseUI = () => useContext(ExpenseUIContext);

// Wraps every logged-in page: checks login, shows the nav bar and the + Add button
export default function AppShell({ title, actions, children }) {
  const { user, loading } = useRequireAuth();
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState({ open: false, expense: null });
  const [version, setVersion] = useState(0); // bumps after every add / edit / delete

  const refreshCategories = useCallback(
    () => api('/api/categories').then(setCategories).catch(() => {}),
    []
  );

  useEffect(() => {
    if (user) refreshCategories();
  }, [user, refreshCategories]);

  const openAdd = useCallback(() => setModal({ open: true, expense: null }), []);
  const openEdit = useCallback((expense) => setModal({ open: true, expense }), []);
  const close = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>;
  }

  return (
    <ExpenseUIContext.Provider value={{ openAdd, openEdit, version, categories, refreshCategories }}>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6">
        {(title || actions) && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {title && <h1 className="text-2xl font-bold">{title}</h1>}
            {actions}
          </div>
        )}
        {children}
      </main>

      {/* Floating + Add button */}
      <button
        onClick={openAdd}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-5 py-4 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
      >
        <span className="text-xl leading-none">+</span> Add expense
      </button>

      <ExpenseModal
        open={modal.open}
        expense={modal.expense}
        categories={categories}
        onClose={close}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </ExpenseUIContext.Provider>
  );
}
