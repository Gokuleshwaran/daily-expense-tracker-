import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata = {
  title: 'Daily Expense Tracker',
  description: 'Log daily expenses and see weekly and monthly spending',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
