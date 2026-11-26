import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/lib/types';

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  login: vi.fn(),
  signup: vi.fn(),
  state: { user: null as unknown, loading: false },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: h.replace }) }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: h.state.user, loading: h.state.loading, login: h.login, signup: h.signup }),
}));

import LoginPage from '@/app/login/page';

const user: User = { id: 1, email: 'asha@example.com', name: 'Asha Rao', currency: 'INR', monthly_budget: null };

const email = () => screen.getByLabelText('Email');
const password = () => screen.getByLabelText('Password');

beforeEach(() => {
  h.state.user = null;
  h.state.loading = false;
});

describe('login mode (default)', () => {
  it('shows the login form without a name field', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: 'Daily Expense Tracker' })).toBeInTheDocument();
    expect(screen.getByText('Welcome back! Log in to continue')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('uses the right input types and autocomplete hints', () => {
    render(<LoginPage />);
    expect(email()).toHaveAttribute('type', 'email');
    expect(password()).toHaveAttribute('type', 'password');
    expect(password()).toHaveAttribute('autocomplete', 'current-password');
    expect(password()).toHaveAttribute('minlength', '6');
  });

  it('logs in with the typed email and password, then goes to the dashboard', async () => {
    h.login.mockResolvedValueOnce(undefined);
    render(<LoginPage />);
    await userEvent.type(email(), 'asha@example.com');
    await userEvent.type(password(), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/dashboard'));
    expect(h.login).toHaveBeenCalledWith('asha@example.com', 'secret1');
    expect(h.signup).not.toHaveBeenCalled();
  });

  it('shows the server error and stays on the page when login fails', async () => {
    h.login.mockRejectedValueOnce(new Error('Wrong email or password'));
    render(<LoginPage />);
    await userEvent.type(email(), 'asha@example.com');
    await userEvent.type(password(), 'badpass');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Wrong email or password')).toBeInTheDocument();
    expect(h.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  it('disables the button and shows "Please wait…" while logging in', async () => {
    let finish: () => void = () => {};
    h.login.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    render(<LoginPage />);
    await userEvent.type(email(), 'asha@example.com');
    await userEvent.type(password(), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
    finish();
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/dashboard'));
  });
});

describe('sign-up mode', () => {
  it('switches to the sign-up form', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByText('Create your account to start tracking')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(password()).toHaveAttribute('autocomplete', 'new-password');
  });

  it('creates an account with name, email and password', async () => {
    h.signup.mockResolvedValueOnce(undefined);
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Asha Rao');
    await userEvent.type(email(), 'asha@example.com');
    await userEvent.type(password(), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/dashboard'));
    expect(h.signup).toHaveBeenCalledWith('Asha Rao', 'asha@example.com', 'secret1');
    expect(h.login).not.toHaveBeenCalled();
  });

  it('shows the error when the email is already registered', async () => {
    h.signup.mockRejectedValueOnce(new Error('An account with this email already exists'));
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Asha');
    await userEvent.type(email(), 'asha@example.com');
    await userEvent.type(password(), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('switches back to login and clears the previous error', async () => {
    h.signup.mockRejectedValueOnce(new Error('An account with this email already exists'));
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Asha');
    await userEvent.type(email(), 'asha@example.com');
    await userEvent.type(password(), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('An account with this email already exists');

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.queryByText('An account with this email already exists')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.getByText('Welcome back! Log in to continue')).toBeInTheDocument();
  });

  it('keeps what was typed when switching modes', async () => {
    render(<LoginPage />);
    await userEvent.type(email(), 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(email()).toHaveValue('asha@example.com');
  });
});

describe('redirects', () => {
  it('sends an already logged-in user straight to the dashboard', () => {
    h.state.user = user;
    render(<LoginPage />);
    expect(h.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('waits while the saved login is still being checked', () => {
    h.state.user = user;
    h.state.loading = true;
    render(<LoginPage />);
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('does not redirect a logged-out visitor', () => {
    render(<LoginPage />);
    expect(h.replace).not.toHaveBeenCalled();
  });
});
