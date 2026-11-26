---
name: add-api-endpoint
description: Add or change an Express API endpoint in this expense tracker end to end (backend route, shared types, frontend call, docs). Use whenever a feature needs new data from the server or a new /api route.
---

# Add an API endpoint

Work through these steps in order. Keep backend and frontend types in sync.

## 1. Types (backend)

In `backend/src/types/models.ts`, add or extend the interfaces for the request body and
the response. Reuse existing types (`Expense`, `Category`, …) where possible.

## 2. Route (backend)

- Add the handler to the router that owns the resource in `backend/src/routes/`.
  A brand-new resource gets a new file `backend/src/routes/<resource>.ts` that ends with `export default router;`.
- Follow the pattern in `backend/CLAUDE.md`:
  - `async (req, res, next) => { try { … } catch (err) { next(err); } }`
  - validate input first → `res.status(400).json({ error: '…' }); return;`
  - parameterised SQL through `query<T>()` from `../db`
  - **every query filters by `user_id = req.userId`**
  - update/delete: `WHERE id = $1 AND user_id = $2`, 404 when `rowCount` is 0
- New router file: mount it in `backend/src/index.ts`, behind `requireAuth` unless it is a public auth route:
  `app.use('/api/<resource>', requireAuth, <resource>Routes);`

## 3. Database (if needed)

If the endpoint needs a new table or column, follow the `db-schema-change` skill first.

## 4. Types (frontend)

Mirror the new or changed types in `frontend/lib/types.ts` (same field names and types).

## 5. Frontend call

Call it with the typed helper, never raw `fetch`:

```ts
const result = await api<MyResponse>('/api/<resource>', { method: 'POST', body });
```

Handle errors with `setError(errorMessage(err))`. If the call changes expenses, trigger a refresh
through `useExpenseUI()` (the `version` counter) so lists and the dashboard update.

## 6. Docs

Add the route to the **API routes** table in `backend/README.md` (method, path, body, what it does).

## 7. Verify

- `npm run typecheck` in `backend/` and `frontend/`: zero errors
- Start the backend (`npm run dev`) and hit the route once with an auth header to check:
  the happy path, a validation error, and that another user's id returns 404
- `npm run build` in `frontend/` before calling it done
