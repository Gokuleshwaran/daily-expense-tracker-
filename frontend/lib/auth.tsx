'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, setToken } from './api';
import type { AuthResponse, User } from './types';

interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, check if a saved token is still valid
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<User>('/api/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    setUser(user);
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const { token, user } = await api<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: { name, email, password },
    });
    setToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Use at the top of any page that needs a logged-in user
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.user) router.replace('/login');
  }, [auth.loading, auth.user, router]);
  return auth;
}

// For components rendered inside <AppShell>, where login is already guaranteed
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser must be used on a logged-in page');
  return user;
}
