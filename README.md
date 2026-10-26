# VocalMaster AI（AI 聲樂教練）

Multi-user web app: record or upload singing → Gemini vocal analysis (timbre / mechanism / breath / pitch) → progress tracking & leaderboards.

**Stack:** Next.js (App Router) · Tailwind CSS · Supabase (Auth / Postgres / Storage) · Google GenAI SDK (Gemini 2.5)

## Quick start

1. **Install**

```bash
npm install
```

2. **Environment**

Copy `.env.local.example` → `.env.local` and fill in:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key |
| `GEMINI_MODEL` | Optional, default `gemini-3.8-flash` |

3. **Supabase setup**

- Create a project at [supabase.com](https://supabase.com)
- SQL Editor → run `supabase/schema.sql`
- Storage → confirm bucket `recordings` exists (schema inserts it)
- Auth → Email provider enabled (disable “Confirm email” for local testing if you want instant login)

4. **Run**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Purpose |
|---|---|
| `/` | Landing |
| `/login` | Email/password signup & login |
| `/dashboard` | Stats + recent recordings |
| `/sing` | Record (MediaRecorder) or upload → analyze |
| `/result/[id]` | Scores, radar, AI report, actionable advice |
| `/leaderboard` | Personal Best + Global (Friends coming soon) |
| `/api/analyze-vocal` | Server-side Gemini analysis + Storage + DB |

## Database

- `profiles` — username/email linked to `auth.users`
- `recordings` — scores, markdown feedback, advice, audio URL
- `friends` — ready for future friends leaderboard (`pending` / `accepted` / `blocked`)

## Notes

- Audio is stored under `recordings/{user_id}/…` with RLS
- Analysis runs only on the server (`GEMINI_API_KEY` never exposed to the browser)
- Actionable advice is generated in Traditional Chinese with concrete exercises (Twang / lip trill / “ma”, etc.)
