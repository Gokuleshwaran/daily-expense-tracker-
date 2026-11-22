require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { requireAuth } = require('./middleware/auth');

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in environment. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const app = express();

const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim().replace(/\/$/, ''));
app.use(cors({ origin: origins }));
app.use(express.json());

// Friendly message when you open the API URL in a browser
app.get('/', (req, res) => res.json({ message: 'Expense Tracker API is running', health: '/health' }));

// Health check (Render uses this to know the server is up)
app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/expenses', requireAuth, require('./routes/expenses'));
app.use('/api/categories', requireAuth, require('./routes/categories'));
app.use('/api/budget', requireAuth, require('./routes/budget'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  });
