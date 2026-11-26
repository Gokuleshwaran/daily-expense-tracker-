import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, Expense } from '@/lib/types';

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api,
}));

import ExpenseModal from '@/components/ExpenseModal';
import { todayISO } from '@/lib/format';

const categories: Category[] = [
  { id: 1, name: 'Food', color: '#f97316', icon: '🍔', is_default: true },
  { id: 2, name: 'Transport', color: '#3b82f6', icon: '🚌', is_default: true },
];

const existing: Expense = {
  id: 11,
  amount: 250,
  date: '2026-11-20',
  note: 'Lunch',
  payment_method: 'Card',
  category_id: 1,
  category_name: 'Food',
  category_color: '#f97316',
  category_icon: '🍔',
};

function setup(expense: Expense | null = null, open = true) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <ExpenseModal open={open} expense={expense} categories={categories} onClose={onClose} onSaved={onSaved} />
  );
  return { onClose, onSaved, user: userEvent.setup(), ...utils };
}

describe('visibility', () => {
  it('renders nothing when closed', () => {
    const { container } = setup(null, false);
    expect(container).toBeEmptyDOMElement();
  });

  it('closes with the × button, the backdrop and the Escape key', async () => {
    const { user, onClose, container } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(container.querySelector('.bg-slate-900\\/40') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('add mode', () => {
  it('starts empty with today, UPI and every category as a chip', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Add expense' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0')).toHaveValue(null);
    expect(screen.getByLabelText('Date')).toHaveValue(todayISO());
    expect(screen.getByLabelText('Paid by')).toHaveValue('UPI');
    expect(screen.getByRole('button', { name: /Food/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transport/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('does not allow a date in the future', () => {
    setup();
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', todayISO());
  });

  it('offers exactly the four payment methods', () => {
    setup();
    const options = Array.from(screen.getByLabelText('Paid by').querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['UPI', 'Cash', 'Card', 'Other']);
  });

  it('asks for an amount before saving', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText('Enter an amount more than 0')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it('asks for a category before saving', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText('0'), '100');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText('Pick a category')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it('rejects an amount of 0', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText('0'), '0');
    await user.click(screen.getByRole('button', { name: /Food/ }));
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText('Enter an amount more than 0')).toBeInTheDocument();
  });

  it('posts the expense, then reports it saved and closes', async () => {
    api.mockResolvedValueOnce(existing);
    const { user, onSaved, onClose } = setup();

    await user.type(screen.getByPlaceholderText('0'), '250.50');
    await user.click(screen.getByRole('button', { name: /Transport/ }));
    await user.selectOptions(screen.getByLabelText('Paid by'), 'Cash');
    await user.type(screen.getByPlaceholderText('e.g. Lunch with team'), 'Auto fare');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(existing));
    expect(api).toHaveBeenCalledWith('/api/expenses', {
      method: 'POST',
      body: { amount: 250.5, category_id: 2, date: todayISO(), note: 'Auto fare', payment_method: 'Cash' },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the server's error and stays open", async () => {
    api.mockRejectedValueOnce(new Error('Unknown category'));
    const { user, onSaved, onClose } = setup();

    await user.type(screen.getByPlaceholderText('0'), '10');
    await user.click(screen.getByRole('button', { name: /Food/ }));
    await user.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Unknown category')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add expense' })).toBeEnabled();
  });
});

describe('edit mode', () => {
  it("is pre-filled with the expense's values", () => {
    setup(existing);
    expect(screen.getByRole('heading', { name: 'Edit expense' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0')).toHaveValue(250);
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-20');
    expect(screen.getByLabelText('Paid by')).toHaveValue('Card');
    expect(screen.getByPlaceholderText('e.g. Lunch with team')).toHaveValue('Lunch');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('saves with PUT to the expense id', async () => {
    api.mockResolvedValueOnce({ ...existing, amount: 300 });
    const { user, onSaved, onClose } = setup(existing);

    const amount = screen.getByPlaceholderText('0');
    await user.clear(amount);
    await user.type(amount, '300');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/api/expenses/11', {
      method: 'PUT',
      body: { amount: 300, category_id: 1, date: '2026-11-20', note: 'Lunch', payment_method: 'Card' },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('needs two taps to delete', async () => {
    api.mockResolvedValueOnce(null);
    const { user, onSaved, onClose } = setup(existing);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tap again to delete' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(null));
    expect(api).toHaveBeenCalledWith('/api/expenses/11', { method: 'DELETE' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error and stays open when delete fails', async () => {
    api.mockRejectedValueOnce(new Error('Expense not found'));
    const { user, onClose } = setup(existing);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Tap again to delete' }));

    expect(await screen.findByText('Expense not found')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the category empty when the expense lost its category', async () => {
    const { user } = setup({ ...existing, category_id: null, category_name: null });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Pick a category')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
