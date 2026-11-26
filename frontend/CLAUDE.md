# Frontend: Next.js 14 + React 18 + TypeScript

## Layout

- `app/`: App Router pages. Every page is a client component (`'use client'`).
  - `login/`, `dashboard/`, `expenses/`, `settings/`
- `components/AppShell.tsx`: wraps every logged-in page: redirects to `/login` if logged out,
  renders `Nav`, the floating **+ Add expense** button and `ExpenseModal`.
  `useExpenseUI()` gives `openAdd`, `openEdit`, `categories`, `refreshCategories` and `version`
  (bumps after any add/edit/delete; put it in `useEffect` deps to refetch).
- `lib/api.ts`: `api<T>(path, { method, body })`, `errorMessage(err)`, token helpers.
- `lib/auth.tsx`: `useAuth()`, `useRequireAuth()`, `useUser()` (non-null user inside AppShell).
- `lib/format.ts`: `money()`, `todayISO()`, `weekRange()`, `monthRange()`, `dayLabel()`…
- `lib/types.ts`: API types. Keep in sync with `backend/src/types/models.ts`.

## Conventions

- Fetch with `api<Type>()`. Never call `fetch` directly, except for file downloads (see Settings export).
- Show errors with `setError(errorMessage(err))` in a red box:
  `rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700`.
- Styling is Tailwind only. Reuse the component classes in `app/globals.css`:
  `card`, `input`, `btn`, `btn-primary`, `btn-ghost`. Brand colour is `brand-600` (#4f46e5).
- Destructive actions use a two-tap confirm ("Delete" → "Tap again to delete"), not `window.confirm`.
- Charts use Recharts with `isAnimationActive={false}` on `<Bar>` (animation breaks layout on resize).
- Mobile-first: test at ~400px width; the floating Add button covers the bottom-right corner,
  so pages keep `pb-28` (AppShell already adds it).
- New logged-in pages wrap content in `<AppShell title="…">` and add a link in `components/Nav.tsx`.

## Commands

- `npm run dev`: http://localhost:3000 (needs the backend on :4000)
- `npm run typecheck`
- `npm run build`: also type-checks; must pass before a change is done

## Gotchas

- `NEXT_PUBLIC_API_URL` is baked in at build time. Changing it on Vercel needs a redeploy.
- The login token is stored in `localStorage` under `et_token`. Always access it through `lib/api.ts`.
