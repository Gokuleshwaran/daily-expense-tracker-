# Claude Code setup for this project

These files are committed so everyone who uses Claude Code on this repo gets the same context and guardrails.

| File | Purpose |
| --- | --- |
| `../CLAUDE.md` | Project overview, commands and rules. Claude reads it at the start of every session. |
| `../backend/CLAUDE.md`, `../frontend/CLAUDE.md` | Extra detail, loaded when Claude works in that folder. |
| `settings.json` | Shared permissions and hooks (below). |
| `hooks/protect-env.js` | **PreToolUse**: blocks reading or editing `.env` / `.env.local` (allows `.env.example`). |
| `hooks/typecheck.js` | **PostToolUse**: after a `.ts`/`.tsx` edit, runs `tsc --noEmit` for that package and sends any errors back to Claude to fix. |
| `skills/add-api-endpoint/` | Add an Express route end to end. |
| `skills/add-frontend-page/` | Add a logged-in Next.js page. |
| `skills/db-schema-change/` | Change Supabase tables safely. |

Hooks need **Node.js** on your PATH (you already have it for the project). The type-check hook
skips quietly until you've run `npm install` in `backend/` and `frontend/`.

## Personal settings

Put anything just for you in `.claude/settings.local.json` or `CLAUDE.local.md`.
Both are git-ignored, so they never affect teammates.

## Plugins

Plugins are installable bundles of skills, commands, agents and hooks.

1. In Claude Code, run `/plugin` to browse marketplaces and install a plugin.
2. Choose the **project** scope when installing, so it is saved to `.claude/settings.json`
   (`enabledPlugins` / `extraKnownMarketplaces`) and shared with the team through git.
3. Commit the updated `settings.json`.

Good candidates for this stack: a TypeScript / code-review helper, a commit-message helper, and a
frontend/UI design helper. Add only what the team actually uses.

## Changing these files

Edit them like any other code, on a feature branch, and mention the change in your pull request,
because they change how Claude behaves for everyone.
