import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Expense } from '@/lib/types';

const h = vi.hoisted(() => ({
  api: vi.fn(),
  openAdd: vi.fn(),
  openEdit: vi.fn(),
  state: { version: 0, categories: [] as Category[] },
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: h.api,
}));
// AppShell does its own login check; the page only needs its context
vi.mock('@/components/AppShell', () => ({
  default: ({ title, children }: { title?: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  useExpenseUI: () => ({
    openAdd: h.openAdd,
    openEdit: h.openEdit,
    version: h.state.version,
    categories: h.state.categories,
  }),
}));

import ExpensesPage from '@/app/expenses/page';

// Fixed "today": Wednesday 25 Nov 2026 (week = Mon 23 – Sun 29 Nov)
const TODAY = new Date(2026, 10, 25, 12, 0, 0);

const food: Category = { id: 1, name: 'Food', color: '#f97316', icon: '🍔', is_default: true };
const transport: Category = { id: 2, name: 'Transport', color: '#3b82f6', icon: '🚌', is_default: true };

const expense = (over: Partial<Expense>): Expense => ({
  id: 1,
  amount: 100,
  date: '2026-11-25',
  note: null,
  payment_method: 'UPI',
  category_id: 1,
  category_name: 'Food',
  category_color: '#f97316',
  category_icon: '🍔',
  ...over,
});

const lunch = expense({ id: 1, amount: 250, note: 'Lunch with team' });
const auto = expense({
  id: 2,
  amount: 90,
  note: 'Auto to office',
  payment_method: 'Cash',
  category_id: 2,
  category_name: 'Transport',
  category_icon: '🚌',
});
const shoes = expense({ id: 3, amount: 1200, date: '2026-11-24', note: null, category_name: 'Food' });
const older = expense({ id: 4, amount: 500, date: '2026-11-10', note: 'Groceries' });

/** The query string of the n-th api call, as an object */
const callParams = (n = -1): Record<string, string> => {
  const path = String(h.api.mock.calls.at(n)?.[0] ?? '');
  return Object.fromEntries(new URLSearchParams(path.split('?')[1] ?? ''));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  h.state.version = 0;
  h.state.categories = [food, transport];
  h.api.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loading', () => {
  it('shows the title and loads this month by default', async () => {
    render(<ExpensesPage />);
    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument();
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    expect(String(h.api.mock.calls[0][0])).toMatch(/^\/api\/expenses\?/);
    expect(callParams()).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });

  it('shows "Loading…" until the first response arrives', async () => {
    let finish: (v: Expense[]) => void = () => {};
    h.api.mockReturnValueOnce(new Promise<Expense[]>((resolve) => (finish = resolve)));
    render(<ExpensesPage />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    finish([lunch]);
    expect(await screen.findByText('Lunch with team')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows the error message when loading fails', async () => {
    h.api.mockRejectedValueOnce(new Error('Cannot reach the server. Is the backend running?'));
    render(<ExpensesPage />);
    expect(await screen.findByText('Cannot reach the server. Is the backend running?')).toBeInTheDocument();
  });

  it('reloads when an expense is added, edited or deleted (version changes)', async () => {
    const { rerender } = render(<ExpensesPage />);
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    h.state.version = 1;
    rerender(<ExpensesPage />);
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(2));
  });
});

describe('list', () => {
  it('groups expenses by day with Today / Yesterday labels and day totals', async () => {
    h.api.mockResolvedValueOnce([lunch, auto, shoes, older]);
    render(<ExpensesPage />);

    const today = (await screen.findByRole('heading', { name: 'Today' })).closest('section')!;
    expect(within(today).getByText('₹340.00')).toBeInTheDocument(); // 250 + 90
    expect(within(today).getByText('Lunch with team')).toBeInTheDocument();
    expect(within(today).getByText('Auto to office')).toBeInTheDocument();

    const yesterday = screen.getByRole('heading', { name: 'Yesterday' }).closest('section')!;
    expect(within(yesterday).getAllByText('₹1,200.00')).toHaveLength(2); // day total + the row

    expect(screen.getByRole('heading', { name: /10 Nov,? 2026/ })).toBeInTheDocument();
  });

  it('keeps the newest day first', async () => {
    h.api.mockResolvedValueOnce([lunch, shoes, older]);
    render(<ExpensesPage />);
    await screen.findByRole('heading', { name: 'Today' });
    const days = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
    expect(days[0]).toBe('Today');
    expect(days[1]).toBe('Yesterday');
    expect(days[2]).toMatch(/10 Nov,? 2026/);
  });

  it('shows the count and overall total', async () => {
    h.api.mockResolvedValueOnce([lunch, auto, shoes]);
    render(<ExpensesPage />);
    expect(await screen.findByText('3 expenses')).toBeInTheDocument();
    expect(screen.getByText('₹1,540.00')).toBeInTheDocument();
  });

  it('uses "expense" for a single item', async () => {
    h.api.mockResolvedValueOnce([lunch]);
    render(<ExpensesPage />);
    expect(await screen.findByText('1 expense')).toBeInTheDocument();
  });

  it('shows category and payment method under each row', async () => {
    h.api.mockResolvedValueOnce([auto]);
    render(<ExpensesPage />);
    expect(await screen.findByText('Transport · Cash')).toBeInTheDocument();
  });

  it('falls back to the category name when there is no note', async () => {
    h.api.mockResolvedValueOnce([shoes]);
    render(<ExpensesPage />);
    const row = await screen.findByRole('button', { name: /₹1,200\.00/ });
    expect(within(row).getByText('Food', { selector: 'span.font-medium' })).toBeInTheDocument();
  });

  it('shows "Uncategorised" when the category was deleted', async () => {
    h.api.mockResolvedValueOnce([
      expense({ note: 'Old bill', category_id: null, category_name: null, category_icon: null, category_color: null }),
    ]);
    render(<ExpensesPage />);
    expect(await screen.findByText('Uncategorised · UPI')).toBeInTheDocument();
  });

  it('opens the edit form with the expense when a row is tapped', async () => {
    h.api.mockResolvedValueOnce([lunch, auto]);
    render(<ExpensesPage />);
    await userEvent.click(await screen.findByText('Auto to office'));
    expect(h.openEdit).toHaveBeenCalledWith(auto);
  });
});

describe('empty state', () => {
  it('explains there is nothing yet and offers an Add button', async () => {
    render(<ExpensesPage />);
    expect(await screen.findByText('No expenses here yet')).toBeInTheDocument();
    expect(screen.getByText('0 expenses')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ Add expense' }));
    expect(h.openAdd).toHaveBeenCalledTimes(1);
  });
});

describe('date presets', () => {
  it.each([
    ['This week', { from: '2026-11-23', to: '2026-11-29' }],
    ['Last month', { from: '2026-10-01', to: '2026-10-31' }],
    ['This month', { from: '2026-11-01', to: '2026-11-30' }],
  ])('"%s" loads the right date range', async (label, expected) => {
    render(<ExpensesPage />);
    await waitFor(() => expect(h.api).toHaveBeenCalled());
    if (label === 'This month') await userEvent.click(screen.getByRole('button', { name: 'This week' }));
    await userEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(callParams()).toEqual(expected));
  });

  it('"All time" sends no dates', async () => {
    render(<ExpensesPage />);
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'All time' }));
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(2));
    expect(callParams()).toEqual({});
  });

  it('"Custom" shows From / To fields that drive the range', async () => {
    render(<ExpensesPage />);
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    // Custom starts from the range that was showing
    expect(from).toHaveValue('2026-11-01');
    expect(to).toHaveValue('2026-11-30');

    await userEvent.clear(from);
    await userEvent.type(from, '2026-11-15');
    await waitFor(() => expect(callParams()).toEqual({ from: '2026-11-15', to: '2026-11-30' }));
  });
});

describe('filters', () => {
  it('lists every category in the filter and adds category_id when one is picked', async () => {
    render(<ExpensesPage />);
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    const select = screen.getByRole('combobox');
    expect(within(select).getByRole('option', { name: 'All categories' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: '🚌 Transport' })).toBeInTheDocument();

    await userEvent.selectOptions(select, '2');
    await waitFor(() => expect(callParams()).toEqual({ from: '2026-11-01', to: '2026-11-30', category_id: '2' }));
  });

  it('searches notes once typing stops (debounced) and trims spaces', async () => {
    render(<ExpensesPage />);
    await waitFor(() => expect(h.api).toHaveBeenCalledTimes(1));
    await userEvent.type(screen.getByPlaceholderText('Search notes…'), '  lunch ');

    await waitFor(() => expect(callParams().q).toBe('lunch'));
    // one request for the page, one for the finished search, not one per key press
    expect(h.api).toHaveBeenCalledTimes(2);
  });

  it('drops the q parameter when the search box is cleared', async () => {
    render(<ExpensesPage />);
    const box = screen.getByPlaceholderText('Search notes…');
    await userEvent.type(box, 'tea');
    await waitFor(() => expect(callParams().q).toBe('tea'));
    await userEvent.clear(box);
    await waitFor(() => expect(callParams().q).toBeUndefined());
  });
});
