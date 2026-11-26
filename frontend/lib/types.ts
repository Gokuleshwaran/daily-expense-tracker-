// Shapes of the data the Express API sends back (mirror of backend/src/types/models.ts)

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['UPI', 'Cash', 'Card', 'Other'];

export interface User {
  id: number;
  email: string;
  name: string;
  currency: string;
  monthly_budget: number | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
}

export interface Expense {
  id: number;
  amount: number;
  date: string; // YYYY-MM-DD
  note: string | null;
  payment_method: PaymentMethod;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
}

export interface ExpenseInput {
  amount: number;
  date: string;
  category_id: number;
  note: string;
  payment_method: PaymentMethod;
}

export type Period = 'week' | 'month';

export interface DayTotal {
  date: string;
  total: number;
}

export interface CategoryTotal {
  name: string;
  color: string;
  icon: string;
  total: number;
  pct: number;
}

export interface TopExpense {
  id: number;
  amount: number;
  date: string;
  note: string | null;
  category_name: string | null;
  category_icon: string | null;
}

export interface Budget {
  amount: number;
  spent: number;
  left: number;
  pct: number | null;
}

export interface Dashboard {
  period: Period;
  from: string;
  to: string;
  total: number;
  prevTotal: number;
  changePct: number | null;
  count: number;
  dailyAverage: number;
  byDay: DayTotal[];
  byCategory: CategoryTotal[];
  top: TopExpense[];
  budget?: Budget | null;
  trend?: { month: string; total: number }[];
}

export interface AuthResponse {
  token: string;
  user: User;
}
