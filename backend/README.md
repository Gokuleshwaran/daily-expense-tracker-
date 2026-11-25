# Daily Expense Tracker — Backend (Node.js + Express + TypeScript)

## 1. Get your Supabase connection string

This project uses **Supabase** (PostgreSQL) as the database. The backend connects to it directly with the `pg` library.

1. Open your project at https://supabase.com/dashboard
2. Click **Connect** (top of the page) → **Connection string** tab
3. Choose **Session pooler** and copy the URI. It looks like:
   `postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
4. Replace `[YOUR-PASSWORD]` with your database password (Project Settings → Database → reset it if you forgot it).
   If the password has symbols like `@`, `#` or `/`, change them to `%40`, `%23`, `%2F`.

Use the **Session pooler** string, not "Direct connection": the direct one only works over IPv6, which Render and many home networks don't support.

## 2. Run it on your computer

Open a terminal in this `backend` folder:

```
npm install
copy .env.example .env
```

Open `.env` and set:

- `DATABASE_URL` = the Supabase Session pooler string from step 1
- `JWT_SECRET` = any long random text (e.g. 40+ random letters and numbers)

Then start the server:

```
npm run dev
```

You should see `API running on http://localhost:4000`.
Tables and default categories are created automatically in Supabase; there is nothing to set up by hand. You can see them in Supabase under **Table Editor**.

Now start the frontend (`npm run dev` in the `frontend` folder) and sign up at http://localhost:3000.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs `src/index.ts` with **tsx** and restarts on every save (for development) |
| `npm run build` | Compiles TypeScript from `src/` into JavaScript in `dist/` |
| `npm start` | Runs the compiled server from `dist/` (used in production / Render) |
| `npm run typecheck` | Checks types without building |

## Project structure

```
backend/
├── src/
│   ├── index.ts            Express app, routes, error handling
│   ├── config.ts           Reads and checks environment variables
│   ├── db.ts               PostgreSQL (Supabase) pool + typed query helper
│   ├── schema.ts           Table definitions (run on start)
│   ├── middleware/auth.ts  JWT sign + requireAuth
│   ├── routes/             auth, expenses, categories, budget, dashboard
│   └── types/
│       ├── models.ts       Shared types (Expense, Category, DashboardResponse…)
│       └── express.d.ts    Adds req.userId to Express's Request type
├── tsconfig.json
└── dist/                   Compiled output (git-ignored)
```

## API routes

All routes except signup/login need the header `Authorization: Bearer <token>`.

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/auth/signup` | `{ name, email, password }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/expenses?from=&to=&category_id=&q=` | List expenses (newest first) |
| POST | `/api/expenses` | `{ amount, date, category_id, note, payment_method }` |
| PUT | `/api/expenses/:id` | Edit an expense |
| DELETE | `/api/expenses/:id` | Delete an expense |
| GET | `/api/expenses/export.csv?from=&to=` | Download as CSV |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | `{ name, color, icon }` |
| DELETE | `/api/categories/:id` | Delete a custom category |
| PUT | `/api/budget` | `{ monthly_budget }` |
| GET | `/api/dashboard?period=week\|month&date=&today=` | Totals, by day, by category, top 5, budget, 6-month trend |
| GET | `/health` | Health check |

Weeks run Monday to Sunday. `payment_method` is one of `Cash`, `UPI`, `Card`, `Other`.

## Deploy to Render

1. Push the project to GitHub.
2. On https://render.com → **New → Web Service** → pick your repo.
3. Settings: **Root Directory** `backend`, **Build Command** `npm install --include=dev && npm run build`, **Start Command** `npm start`.
   (`--include=dev` makes sure TypeScript is installed so the build can run.)
4. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN` (your Vercel frontend URL, e.g. `https://my-tracker.vercel.app`).
5. Deploy, then open `https://<your-service>.onrender.com/health`. It should show `{"ok":true}`.

(Or use the `render.yaml` file in the project root: **New → Blueprint**.)

Note: the free plan sleeps after ~15 minutes idle, so the first request after that can take up to a minute.
