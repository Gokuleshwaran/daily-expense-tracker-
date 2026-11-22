# Daily Expense Tracker — Frontend (Next.js)

## Run it on your computer

1. Install Node.js 18 or newer from https://nodejs.org
2. Open a terminal in this `frontend` folder and run:

   ```
   npm install
   copy .env.example .env.local
   npm run dev
   ```

3. Open http://localhost:3000

## What's built so far

- Login / Sign up page (`app/login/page.js`)
- Login state saved in the browser (`lib/auth.js`)
- API helper that sends the login token to the backend (`lib/api.js`)
- Top navigation and placeholder Dashboard, Expenses and Settings pages

Logging in needs the Express backend running at `NEXT_PUBLIC_API_URL`
(set in `.env.local`, default http://localhost:4000).
