'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const LINKS: { href: string; label: string }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/settings', label: 'Settings' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">₹</span>
          <span className="hidden sm:inline">Expense Tracker</span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname.startsWith(l.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-slate-500 md:inline">Hi, {user?.name?.split(' ')[0]}</span>
          <button
            className="btn-ghost whitespace-nowrap px-3 py-1.5"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
