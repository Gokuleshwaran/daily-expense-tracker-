import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, ApiError, api, errorMessage, getToken, setToken } from '@/lib/api';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

/** A minimal fetch Response */
const respond = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (body === undefined) throw new Error('no body');
    return body;
  },
});

describe('token helpers', () => {
  it('stores, reads and removes the token under et_token', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(localStorage.getItem('et_token')).toBe('abc');
    expect(getToken()).toBe('abc');
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it('returns null instead of throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getToken()).toBeNull();
  });

  it('does not throw when storage is blocked on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setToken('abc')).not.toThrow();
  });
});

describe('api()', () => {
  it('calls the backend URL with GET by default and parses the JSON', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, [{ id: 1 }]));
    const data = await api<{ id: number }[]>('/api/expenses');
    expect(data).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/expenses`, expect.objectContaining({ method: 'GET' }));
  });

  it('sends JSON headers and no Authorization when logged out', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, {}));
    await api('/api/x');
    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('adds the Bearer token when logged in', async () => {
    setToken('tok123');
    fetchMock.mockResolvedValueOnce(respond(200, {}));
    await api('/api/x');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok123');
  });

  it('serialises the body as JSON', async () => {
    fetchMock.mockResolvedValueOnce(respond(201, { id: 5 }));
    await api('/api/expenses', { method: 'POST', body: { amount: 10, note: 'tea' } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"amount":10,"note":"tea"}');
  });

  it('sends no body when none is given', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, {}));
    await api('/api/x');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it('returns null for 204 No Content without reading a body', async () => {
    fetchMock.mockResolvedValueOnce(respond(204));
    expect(await api('/api/expenses/1', { method: 'DELETE' })).toBeNull();
  });

  it("throws an ApiError carrying the server's message and status", async () => {
    fetchMock.mockResolvedValueOnce(respond(400, { error: 'Pick a category' }));
    const err = await api('/api/expenses', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe('Pick a category');
    expect((err as ApiError).status).toBe(400);
  });

  it('falls back to a generic message when the error has no text', async () => {
    fetchMock.mockResolvedValueOnce(respond(500, {}));
    await expect(api('/api/x')).rejects.toThrow('Request failed (500)');
  });

  it('copes with an error response that is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(respond(502));
    await expect(api('/api/x')).rejects.toThrow('Request failed (502)');
  });

  it('turns a network failure into a friendly message', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api('/api/x')).rejects.toThrow('Cannot reach the server. Is the backend running?');
  });
});

describe('errorMessage', () => {
  it("returns an Error's message", () => {
    expect(errorMessage(new Error('Nope'))).toBe('Nope');
    expect(errorMessage(new ApiError('Bad', 400))).toBe('Bad');
  });

  it('returns a generic message for anything else', () => {
    expect(errorMessage('boom')).toBe('Something went wrong');
    expect(errorMessage(null)).toBe('Something went wrong');
    expect(errorMessage({ message: 'x' })).toBe('Something went wrong');
  });
});
