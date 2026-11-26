import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb } from './db';
import { requireAuth } from './middleware/auth';
import authRoutes from './routes/auth';
import expenseRoutes from './routes/expenses';
import categoryRoutes from './routes/categories';
import budgetRoutes from './routes/budget';
import dashboardRoutes from './routes/dashboard';

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// Friendly message when you open the API URL in a browser
app.get('/', (_req, res) => {
  res.json({ message: 'Expense Tracker API is running', health: '/health' });
});

// Health check (Render uses this to know the server is up)
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/expenses', requireAuth, expenseRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/budget', requireAuth, budgetRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

initDb()
  .then(() => {
    app.listen(config.port, () => console.log(`API running on http://localhost:${config.port}`));
  })
  .catch((err: Error) => {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  });
