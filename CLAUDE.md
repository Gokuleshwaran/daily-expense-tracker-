# Daily Expense Tracker

A web app to log daily expenses and see weekly / monthly spending on a dashboard.
Users are in India: amounts are **INR (₹)**, formatted with `en-IN`.

## Stack

| Part | Tech | Folder |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts | `frontend/` |
| Backend | Node.js, Express 4, TypeScript (tsx in dev, tsc build to `dist/`) | `backend/` |
| Database | Supabase PostgreSQL, accessed with `pg` (no Supabase JS client, no ORM) | `backend/src/db.ts` |
| Auth | Email + password, bcryptjs hashes, JWT (30 days) in `Authorization: Bearer` | `backend/src/middleware/auth.ts` |
| Hosting | Frontend on Vercel, backend on Render (`render.yaml`) | |

`backend/CLAUDE.md` and `frontend/CLAUDE.md` have the details for each part.

## Commands

Run from inside `backend/` or `frontend/`:

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev server | `npm run dev` (backend :4000, frontend :3000) |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |

There is no test suite yet. Verify changes with `npm run typecheck` in the package you touched,
and `npm run build` before saying a change is finished.

## How the pieces connect

- Frontend calls the API only through `api<T>()` in `frontend/lib/api.ts` (base URL from `NEXT_PUBLIC_API_URL`).
- All API routes except `/api/auth/signup` and `/api/auth/login` sit behind `requireAuth`, which sets `req.userId`.
- **Every SQL query must filter by `user_id = req.userId`.** Users must never see each other's data.
- Response types are defined twice and must stay in sync:
  `backend/src/types/models.ts` ↔ `frontend/lib/types.ts`.
- Tables are created by `backend/src/schema.ts` on server start (idempotent SQL, RLS enabled).

## Rules

- TypeScript strict mode everywhere. No `any`; use `unknown` and narrow it.
- Never read, print or edit `.env` / `.env.local` files. Only `.env.example` files may change.
  Never put secrets, connection strings or tokens in code, docs or commits.
- Dates are `YYYY-MM-DD` strings. Weeks run **Monday to Sunday**. Use the helpers in
  `frontend/lib/format.ts` (frontend) and the UTC helpers in `backend/src/routes/dashboard.ts` (backend);
  don't use `toISOString()` for a local date on the frontend.
- Format money with `money()` from `frontend/lib/format.ts`. Never hand-build `₹` strings.
- Payment methods are exactly `Cash | UPI | Card | Other`.
- Keep the UI mobile-first; check layouts at phone width (~400px).
- When you add or change an API route, update the route table in `backend/README.md`.

## Git

- Work on feature branches (`feature/<name>`); `main` is updated through pull requests.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- Never commit `.env` files, `node_modules`, `.next` or `dist` (already in `.gitignore`).

## Project skills

Step-by-step guides in `.claude/skills/`:

- `add-api-endpoint`: new Express route, end to end
- `add-frontend-page`: new logged-in page
- `db-schema-change`: change tables safely on Supabase
