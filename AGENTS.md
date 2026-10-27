<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent

VocalMaster AI is a Next.js app. Auth, Postgres, and Storage come from Supabase. Vocal scoring calls Gemini only when `GEMINI_API_KEY` is set.

On a Cloud Agent boot, `scripts/cloud-agent-start.sh` starts a local Supabase stack with the native runtime (no Docker) and then `npm run dev` on port 3000. It writes `.env.local` from `supabase stack status`. Email confirmation is off, so signup can sign in immediately. If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already present, the script uses those and does not start the local stack.

`GEMINI_API_KEY` is not required to boot, sign up, or use the dashboard. `/api/analyze-vocal` returns an error until that secret is set. `GEMINI_MODEL` is optional and defaults to `gemini-3.8-flash`.

Commands:

- `npm run dev` — Next.js dev server
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck
- `npm run build` — production build
- `bash scripts/cloud-agent-install.sh` — install dependencies and local Supabase artifacts
- `bash scripts/cloud-agent-start.sh` — start local Supabase and the dev server
