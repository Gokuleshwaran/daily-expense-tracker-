---
name: add-frontend-page
description: Create a new logged-in page in the Next.js frontend of this expense tracker (App Router + TypeScript + Tailwind), wired into the nav and the shared expense context. Use when the user asks for a new screen or section.
---

# Add a frontend page

## 1. Create the route

Create `frontend/app/<route>/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import AppShell, { useExpenseUI } from '@/components/AppShell';
import { api, errorMessage } from '@/lib/api';
import type { Expense } from '@/lib/types';

export default function MyPage() {
  return (
    <AppShell title="My page">
      <MyPageContent />
    </AppShell>
  );
}

// Hooks like useExpenseUI() only work *inside* AppShell, so the content is its own component
function MyPageContent() {
  const { version } = useExpenseUI();
  const [data, setData] = useState<Expense[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Expense[]>('/api/expenses')
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [version]); // refetch after any add / edit / delete

  return <div className="card">…</div>;
}
```

## 2. Add it to the navigation

Add `{ href: '/<route>', label: '<Label>' }` to `LINKS` in `frontend/components/Nav.tsx`.
Keep labels short: the nav must fit on a ~400px phone screen.

## 3. Style it like the rest of the app

- Containers: `card`. Inputs: `input`. Buttons: `btn-primary` / `btn-ghost` (see `app/globals.css`).
- Money: `money(n)`. Dates: helpers in `lib/format.ts` (`dayLabel`, `todayISO`, `weekRange`…).
- Empty states: a centred `card` with an emoji, one bold line and one hint line (see `app/expenses/page.tsx`).
- Errors: `rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700`.
- Charts: Recharts with `isAnimationActive={false}`.

## 4. Verify

- `npm run typecheck` and `npm run build` in `frontend/`
- Open the page at desktop width and at ~400px phone width; check that nothing overflows
  and the floating **+ Add expense** button doesn't hide important content
- Log out and open the URL directly: it must redirect to `/login`
