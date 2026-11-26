// Small wrapper around fetch that talks to the Express backend.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'et_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: user just stays logged in for this tab */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiOptions {
  method?: Method;
  body?: unknown;
}

/**
 * Calls the API and returns the parsed JSON, typed as T.
 * Example: const expenses = await api<Expense[]>('/api/expenses');
 */
export async function api<T = unknown>(path: string, { method = 'GET', body }: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }

  if (res.status === 204) return null as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

/** Turns any thrown value into a message to show the user */
export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : 'Something went wrong');
