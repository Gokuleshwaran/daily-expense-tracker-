# 💸 Daily Expense Tracker

A simple web app to log your daily expenses in seconds and see where your money goes, week by week and month by month.

## Features

- **Sign up / log in** with email and password (JWT authentication)
- **Add, edit and delete expenses** with amount, category, date, payment method (UPI / Cash / Card / Other) and an optional note
- **8 default categories**: Food, Transport, Rent, Bills, Shopping, Health, Entertainment, Other
- **Expenses list** grouped by day, with filters (this week, this month, last month, all time, custom dates), a category filter and note search
- **Dashboard** with a Week / Month toggle:
  - Total spent and % change vs the previous week or month
  - Daily average and number of expenses
  - Spending-by-day bar chart
  - Category breakdown with amounts and percentages
  - Top 5 expenses
  - Monthly budget with a progress bar (turns orange at 80%, red when over)
  - 6-month spending trend
- **Settings page** to set your monthly budget, add or delete custom categories (own name, icon and colour) and download your expenses as a CSV file
- **Mobile-friendly** layout with a floating **+ Add expense** button
- Amounts in Indian Rupees (₹)

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (React 18), Tailwind CSS, Recharts |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL) |
| Auth | JWT + bcrypt |
| Hosting | Vercel (frontend), Render (backend) |

## Project structure

```
Daily Expence Tracker/
├── backend/                 Node.js + Express API
│   ├── src/
│   │   ├── index.js         Server setup, routes, CORS
│   │   ├── db.js            PostgreSQL (Supabase) connection
│   │   ├── schema.sql       Tables (created automatically on start)
│   │   ├── middleware/
│   │   │   └── auth.js      Checks the login token
│   │   └── routes/
│   │       ├── auth.js      Sign up, log in, current user
│   │       ├── expenses.js  Add / list / edit / delete / CSV export
│   │       ├── categories.js
│   │       ├── budget.js
│   │       └── dashboard.js Weekly and monthly totals
│   ├── .env.example
│   └── README.md            Backend setup + full API reference
├── frontend/                Next.js app
│   ├── app/
│   │   ├── login/           Login and sign-up page
│   │   ├── dashboard/       Weekly / monthly dashboard
│   │   ├── expenses/        Expense list with filters
│   │   └── settings/        Budget, custom categories, CSV export
│   ├── components/          Nav bar, app shell, Add/Edit expense form
│   ├── lib/                 API helper, login state, date & ₹ formatting
│   └── .env.example
├── render.yaml              Render deployment blueprint
└── README.md                This file
```

## Run it locally

You need **Node.js 18+** and a free **Supabase** project.

### 1. Backend

```
cd backend
npm install
copy .env.example .env
```

Edit `backend/.env`:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase → **Connect** → **Direct** → **Session pooler** connection string, with your database password filled in |
| `JWT_SECRET` | Any long random text (40+ characters) |
| `CORS_ORIGIN` | `http://localhost:3000` |
| `PORT` | `4000` |

```
npm run dev
```

You should see `API running on http://localhost:4000`. The tables and default categories are created in Supabase automatically.

### 2. Frontend

In a second terminal:

```
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

`frontend/.env.local` should contain:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Open **http://localhost:3000** and sign up.

## Deploy

1. **GitHub**: push this project to a private repository. `.env` files and `node_modules` are excluded by `.gitignore`.
2. **Render (backend)**: New → Web Service → pick the repo.
   - Root Directory: `backend` · Build: `npm install` · Start: `npm start`
   - Environment: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your Vercel URL)
   - Check `https://<your-service>.onrender.com/health` returns `{"ok":true}`
3. **Vercel (frontend)**: Add New → Project → pick the repo.
   - Root Directory: `frontend`
   - Environment: `NEXT_PUBLIC_API_URL` = your Render URL
4. Put the Vercel URL into Render's `CORS_ORIGIN` and redeploy.

Note: Render's free plan sleeps after ~15 minutes idle, so the first request after that can take up to a minute.

## API overview

All routes except sign up and log in need `Authorization: Bearer <token>`. See [`backend/README.md`](backend/README.md) for the full list.

| Route | Purpose |
| --- | --- |
| `POST /api/auth/signup`, `POST /api/auth/login` | Create account / log in |
| `GET, POST /api/expenses` · `PUT, DELETE /api/expenses/:id` | Manage expenses |
| `GET /api/expenses/export.csv` | Download expenses as CSV |
| `GET, POST /api/categories` · `DELETE /api/categories/:id` | Manage categories |
| `PUT /api/budget` | Set the monthly budget |
| `GET /api/dashboard?period=week\|month` | Dashboard numbers |

## Roadmap

- [x] Login and sign up
- [x] Add / edit / delete expenses
- [x] Expense list with filters and search
- [x] Weekly and monthly dashboard with charts
- [x] Monthly budget
- [x] Settings page (custom categories, budget, CSV export)
- [ ] Deploy to Render + Vercel
- [ ] Recurring expenses, installable phone app (PWA), per-category budgets
