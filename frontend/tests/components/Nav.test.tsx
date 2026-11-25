import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { replace, logout, pathname, auth } = vi.hoisted(() => ({
  replace: vi.fn(),
  logout: vi.fn(),
  pathname: { current: '/dashboard' },
  auth: { user: { name: 'Asha Rao' } as { name: string } | null },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ replace }),
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: auth.user, logout }) }));

import Nav from '@/components/Nav';

describe('Nav', () => {
  it('links to the three main pages', () => {
    render(<Nav />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Expenses' })).toHaveAttribute('href', '/expenses');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it.each([
    ['/dashboard', 'Dashboard'],
    ['/expenses', 'Expenses'],
    ['/settings', 'Settings'],
  ])('highlights only the current page (%s)', (path, label) => {
    pathname.current = path;
    render(<Nav />);
    for (const name of ['Dashboard', 'Expenses', 'Settings']) {
      const link = screen.getByRole('link', { name });
      if (name === label) expect(link).toHaveClass('bg-brand-50');
      else expect(link).not.toHaveClass('bg-brand-50');
    }
  });

  it("greets the user by first name", () => {
    auth.user = { name: 'Asha Rao' };
    render(<Nav />);
    expect(screen.getByText('Hi, Asha')).toBeInTheDocument();
  });

  it('logs out and goes to the login page', async () => {
    render(<Nav />);
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
