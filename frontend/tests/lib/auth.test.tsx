import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setToken } from '@/lib/api';
import type { User } from '@/lib/types';

const { api, replace } = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn() }));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { AuthProvider, useAuth, useRequireAuth, useUser } from '@/lib/auth';

const user: User = { id: 1, email: 'asha@example.com', name: 'Asha', currency: 'INR', monthly_budget: null };
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  localStorage.clear();
});

describe('AuthProvider on first load', () => {
  it('finishes loading straight away when there is no saved token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it('restores the user when the saved token is still valid', async () => {
    setToken('saved');
    api.mockResolvedValueOnce(user);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api).toHaveBeenCalledWith('/api/auth/me');
    expect(result.current.user).toEqual(user);
  });

  it('forgets the token when the server rejects it', async () => {
    setToken('expired');
    api.mockRejectedValueOnce(new Error('Session expired'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(getToken()).toBeNull();
  });
});

describe('login / signup / logout', () => {
  it('login stores the token and sets the user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.mockResolvedValueOnce({ token: 'new-token', user });

    await act(() => result.current.login('asha@example.com', 'secret123'));

    expect(api).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { email: 'asha@example.com', password: 'secret123' },
    });
    expect(getToken()).toBe('new-token');
    expect(result.current.user).toEqual(user);
  });

  it('a failed login leaves the user logged out and passes the error on', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.mockRejectedValueOnce(new Error('Wrong email or password'));

    await expect(act(() => result.current.login('a@b.com', 'bad'))).rejects.toThrow('Wrong email or password');
    expect(result.current.user).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('signup sends name, email and password, then logs in', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.mockResolvedValueOnce({ token: 'tok', user });

    await act(() => result.current.signup('Asha', 'asha@example.com', 'secret123'));

    expect(api).toHaveBeenCalledWith('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Asha', email: 'asha@example.com', password: 'secret123' },
    });
    expect(getToken()).toBe('tok');
    expect(result.current.user).toEqual(user);
  });

  it('logout clears the token and the user', async () => {
    setToken('saved');
    api.mockResolvedValueOnce(user);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));

    act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(getToken()).toBeNull();
  });
});

describe('useAuth', () => {
  it('throws a helpful error outside <AuthProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside <AuthProvider>');
  });
});

describe('useRequireAuth', () => {
  it('redirects to /login when nobody is logged in', async () => {
    const { result } = renderHook(() => useRequireAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('does not redirect while the saved token is still being checked', () => {
    setToken('saved');
    api.mockReturnValueOnce(new Promise(() => {})); // never resolves
    renderHook(() => useRequireAuth(), { wrapper });
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect a logged-in user', async () => {
    setToken('saved');
    api.mockResolvedValueOnce(user);
    const { result } = renderHook(() => useRequireAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(user));
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('useUser', () => {
  it('returns the logged-in user', async () => {
    setToken('saved');
    api.mockResolvedValueOnce(user);
    function Probe() {
      return <p>Logged in as {useUser().name}</p>;
    }
    function Gate() {
      return useAuth().user ? <Probe /> : null;
    }
    render(
      <AuthProvider>
        <Gate />
      </AuthProvider>
    );
    expect(await screen.findByText('Logged in as Asha')).toBeInTheDocument();
  });

  it('throws when nobody is logged in', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useUser(), { wrapper })).toThrow('useUser must be used on a logged-in page');
  });
});
