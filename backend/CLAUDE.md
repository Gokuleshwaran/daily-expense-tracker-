# Backend: Node.js + Express + TypeScript

## Layout

- `src/index.ts`: Express app, mounts routers, 404 + error handler, calls `initDb()` then `listen`.
- `src/config.ts`: the **only** place that reads `process.env`. Import `config` instead.
- `src/db.ts`: `pg` Pool + `query<T>(sql, params)`. DATE columns come back as `'YYYY-MM-DD'` strings,
  NUMERIC as `number` (type parsers set here).
- `src/schema.ts`: `SCHEMA_SQL`, run on every start. Must stay idempotent.
- `src/middleware/auth.ts`: `signToken`, `requireAuth` (sets `req.userId: number`).
- `src/types/models.ts`: row and response types. `src/types/express.d.ts` adds `req.userId`.
- `src/routes/*.ts`: one router per resource: auth, expenses, categories, budget, dashboard.

## Route conventions

Follow the existing routers exactly:

```ts
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query<Category>('SELECT ... WHERE user_id = $1', [req.userId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
```

- Always `try { … } catch (err) { next(err); }`. The global handler returns a generic 500.
- Validation errors: `res.status(400).json({ error: 'Human readable message' }); return;`
- Errors are always `{ error: string }`, written for end users.
- Parameterised SQL only (`$1, $2…`). Never interpolate user input into SQL.
- Scope every query to `req.userId`; on update/delete use `WHERE id = $1 AND user_id = $2`
  and return 404 when `rowCount` is 0.
- Type request bodies with an interface and cast `req.body as X`, then validate.

## Commands

- `npm run dev`: tsx watch on `src/index.ts`
- `npm run typecheck`: must pass with zero errors
- `npm run build` then `npm start`: what Render runs

## Gotchas

- Supabase must be reached through the **Session pooler** URL (IPv4); the direct URL is IPv6-only.
- `ssl: { rejectUnauthorized: false }` is used for any non-localhost database.
- Render's build command is `npm install --include=dev && npm run build` (TypeScript is a devDependency).
