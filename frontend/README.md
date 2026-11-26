# Daily Expense Tracker — Frontend (Next.js + React + TypeScript)

## Run it on your computer

1. Install Node.js 18 or newer from https://nodejs.org
2. Open a terminal in this `frontend` folder and run:

   ```
   npm install
   copy .env.example .env.local
   npm run dev
   ```

3. Open http://localhost:3000

The Express backend must be running at `NEXT_PUBLIC_API_URL` (set in `.env.local`, default http://localhost:4000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Runs the production build |
| `npm run typecheck` | Checks TypeScript types only |

## Project structure

```
frontend/
├── app/                      Next.js App Router pages
│   ├── layout.tsx            Root layout + AuthProvider
│   ├── page.tsx              Redirects to /dashboard or /login
│   ├── login/page.tsx        Login and sign-up
│   ├── dashboard/page.tsx    Week / Month dashboard with charts (Recharts)
│   ├── expenses/page.tsx     Expense list with filters and search
│   └── settings/page.tsx     Account, budget, categories, CSV export
├── components/
│   ├── AppShell.tsx          Logged-in layout, + Add button, shared expense context
│   ├── ExpenseModal.tsx      Add / Edit expense form
│   └── Nav.tsx               Top navigation
├── lib/
│   ├── api.ts                Typed fetch wrapper: api<T>(path, options)
│   ├── auth.tsx              Login state (useAuth, useRequireAuth, useUser)
│   ├── format.ts             ₹ formatting and date helpers
│   └── types.ts              Shared types (Expense, Category, Dashboard…)
├── tailwind.config.ts
└── tsconfig.json
```

Types in `lib/types.ts` mirror `backend/src/types/models.ts`. If you change an API response, update both.
