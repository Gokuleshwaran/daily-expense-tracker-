// Shapes of the rows our API reads from and returns to the frontend

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['Cash', 'UPI', 'Card', 'Other'];

export interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  currency: string;
  monthly_budget: number | null;
  created_at: Date;
}

export type PublicUser = Omit<UserRow, 'password_hash' | 'created_at'>;

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
  amount: number | string;
  date: string;
  category_id: number;
  note?: string;
  payment_method?: PaymentMethod;
}

export type Period = 'week' | 'month';

export interface DashboardResponse {
  period: Period;
  from: string;
  to: string;
  total: number;
  prevTotal: number;
  changePct: number | null;
  count: number;
  dailyAverage: number;
  byDay: { date: string; total: number }[];
  byCategory: { name: string; color: string; icon: string; total: number; pct: number }[];
  top: {
    id: number;
    amount: number;
    date: string;
    note: string | null;
    category_name: string | null;
    category_icon: string | null;
  }[];
  budget?: { amount: number; spent: number; left: number; pct: number | null } | null;
  trend?: { month: string; total: number }[];
}
