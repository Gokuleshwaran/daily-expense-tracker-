'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { user, loading, login, signup } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-2xl text-white">
            ₹
          </div>
          <h1 className="text-2xl font-bold">Daily Expense Tracker</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSignup ? 'Create your account to start tracking' : 'Welcome back! Log in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {isSignup && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Name</span>
              <input className="input" value={form.name} onChange={update('name')} required autoComplete="name" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={update('email')}
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={update('password')}
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="font-semibold text-brand-600 hover:underline"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup');
              setError('');
            }}
          >
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </main>
  );
}
