import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, User } from '@/lib/types';

const h = vi.hoisted(() => ({
  api: vi.fn(),
  getToken: vi.fn(),
  setUser: vi.fn(),
  refreshCategories: vi.fn(),
  state: { user: null as unknown as User, categories: [] as Category[] },
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: h.api,
  getToken: h.getToken,
}));
vi.mock('@/lib/auth', () => ({
  useUser: () => h.state.user,
  useAuth: () => ({ user: h.state.user, setUser: h.setUser }),
}));
// AppShell does its own login check and data loading; the page only needs its context
vi.mock('@/components/AppShell', () => ({
  default: ({ title, children }: { title?: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  useExpenseUI: () => ({ categories: h.state.categories, refreshCategories: h.refreshCategories }),
}));

import SettingsPage from '@/app/settings/page';
import { API_URL } from '@/lib/api';
import { todayISO } from '@/lib/format';

const food: Category = { id: 1, name: 'Food', color: '#f97316', icon: '🍔', is_default: true };
const pets: Category = { id: 9, name: 'Pets', color: '#14b8a6', icon: '🐶', is_default: false };

beforeEach(() => {
  h.state.user = { id: 1, email: 'asha@example.com', name: 'Asha Rao', currency: 'INR', monthly_budget: null };
  h.state.categories = [food, pets];
  h.refreshCategories.mockResolvedValue(undefined);
  h.getToken.mockReturnValue('tok');
});

describe('page', () => {
  it('shows the title and all four sections', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    for (const name of ['Account', 'Monthly budget', 'Categories', 'Export expenses']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
  });
});

describe('Account', () => {
  it('shows name, email and currency', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('INR (₹)')).toBeInTheDocument();
  });
});

describe('Monthly budget', () => {
  it('starts empty when no budget is set', () => {
    render(<SettingsPage />);
    expect(screen.getByPlaceholderText('e.g. 20000')).toHaveValue(null);
  });

  it('is pre-filled with the saved budget', () => {
    h.state.user = { ...h.state.user, monthly_budget: 15000 };
    render(<SettingsPage />);
    expect(screen.getByPlaceholderText('e.g. 20000')).toHaveValue(15000);
  });

  it('saves the budget and updates the logged-in user', async () => {
    h.api.mockResolvedValueOnce({ monthly_budget: 25000 });
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.type(screen.getByPlaceholderText('e.g. 20000'), '25000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.api).toHaveBeenCalledWith('/api/budget', { method: 'PUT', body: { monthly_budget: 25000 } });
    expect(await screen.findByText('Budget set to ₹25,000.00 per month')).toBeInTheDocument();
    expect(h.setUser).toHaveBeenCalledWith({ ...h.state.user, monthly_budget: 25000 });
  });

  it('clears the budget when the field is emptied', async () => {
    h.state.user = { ...h.state.user, monthly_budget: 15000 };
    h.api.mockResolvedValueOnce({ monthly_budget: null });
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.clear(screen.getByPlaceholderText('e.g. 20000'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(h.api).toHaveBeenCalledWith('/api/budget', { method: 'PUT', body: { monthly_budget: null } });
    expect(await screen.findByText('Budget cleared')).toBeInTheDocument();
  });

  it('shows the error when saving fails', async () => {
    h.api.mockRejectedValueOnce(new Error('Budget must be 0 or more'));
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.type(screen.getByPlaceholderText('e.g. 20000'), '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Budget must be 0 or more')).toBeInTheDocument();
    expect(h.setUser).not.toHaveBeenCalled();
  });
});

describe('Categories', () => {
  it('labels default categories and only lets custom ones be deleted', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it("can't add a category without a name", () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: 'Add category' })).toBeDisabled();
  });

  it('adds a category with the chosen icon and colour, then refreshes the list', async () => {
    h.api.mockResolvedValueOnce({ ...pets, id: 10, name: 'Coffee' });
    const user = userEvent.setup();
    render(<SettingsPage />);

    const name = screen.getByPlaceholderText('e.g. Groceries');
    await user.type(name, 'Coffee');
    await user.click(screen.getByRole('button', { name: '☕' }));
    await user.click(screen.getByRole('button', { name: 'Colour #ef4444' }));
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() => expect(h.refreshCategories).toHaveBeenCalled());
    expect(h.api).toHaveBeenCalledWith('/api/categories', {
      method: 'POST',
      body: { name: 'Coffee', icon: '☕', color: '#ef4444' },
    });
    expect(name).toHaveValue('');
  });

  it('shows the error for a duplicate name and keeps what was typed', async () => {
    h.api.mockRejectedValueOnce(new Error('You already have a category with this name'));
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.type(screen.getByPlaceholderText('e.g. Groceries'), 'Food');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('You already have a category with this name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Groceries')).toHaveValue('Food');
    expect(h.refreshCategories).not.toHaveBeenCalled();
  });

  it('needs two taps to delete a custom category', async () => {
    h.api.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(h.api).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    await waitFor(() => expect(h.refreshCategories).toHaveBeenCalled());
    expect(h.api).toHaveBeenCalledWith('/api/categories/9', { method: 'DELETE' });
  });

  it('cancels the delete confirmation when focus moves away', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Tap again to delete' })).toBeInTheDocument();

    await user.click(screen.getByPlaceholderText('e.g. Groceries'));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(h.api).not.toHaveBeenCalled();
  });
});

describe('Export', () => {
  const fetchMock = vi.fn();
  let downloadName = '';

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:csv', configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true, writable: true });
    downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });
  });

  it('defaults the end date to today and leaves the start date empty', () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText('To')).toHaveValue(todayISO());
    expect(screen.getByLabelText(/From/)).toHaveValue('');
  });

  it('fetches the CSV with the login token and saves it as a file', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['a,b']) });
    const user = userEvent.setup();
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText(/From/), { target: { value: '2026-11-01' } });
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(downloadName).toBe(`expenses_2026-11-01_${todayISO()}.csv`));
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/expenses/export.csv?from=2026-11-01&to=${todayISO()}`,
      { headers: { Authorization: 'Bearer tok' } }
    );
  });

  it("names the file 'start' when there is no from date", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(downloadName).toBe(`expenses_start_${todayISO()}.csv`));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('from=');
  });

  it('shows an error when the server refuses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(await screen.findByText('Export failed (401)')).toBeInTheDocument();
    expect(downloadName).toBe('');
  });

  it('shows an error when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
  });

  it('disables the button while preparing', async () => {
    let finish: (v: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
    finish({ ok: true, blob: async () => new Blob(['x']) });
    expect(await screen.findByRole('button', { name: 'Download CSV' })).toBeEnabled();
  });
});
