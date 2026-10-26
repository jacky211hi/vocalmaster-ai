#!/usr/bin/env bash
# Cloud Agent boot: local Supabase (unless hosted credentials are injected) and Next.js.
# Safe to run again. Keeps the dev server in the foreground when it is not already up.
set -euo pipefail
cd /workspace

export SUPABASE_TELEMETRY_DISABLED=1
export SUPABASE_EXPERIMENTAL_STACK=1
export DO_NOT_TRACK=1

if python3 - <<'PY'
import socket
s = socket.socket()
s.settimeout(0.5)
try:
    raise SystemExit(0 if s.connect_ex(("127.0.0.1", 3000)) == 0 else 1)
finally:
    s.close()
PY
then
  echo "next dev is already listening on port 3000"
  exit 0
fi

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  if ! command -v supabase >/dev/null 2>&1; then
    echo "supabase CLI is not installed. Run the environment install step first." >&2
    exit 1
  fi
  if [[ ! -f supabase/config.toml ]]; then
    supabase init --yes
  fi
  python3 - <<'PY'
import pathlib
import re

path = pathlib.Path("supabase/config.toml")
text = path.read_text()
text = re.sub(r'(?m)^site_url = ".*"', 'site_url = "http://localhost:3000"', text, count=1)
text = re.sub(
    r'(?m)^additional_redirect_urls = \[.*\]',
    'additional_redirect_urls = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3000/**", "http://127.0.0.1:3000/**"]',
    text,
    count=1,
)
text = text.replace('project_id = "workspace"', 'project_id = "vocalmaster-ai"', 1)
sections = [
    "realtime",
    "studio",
    "local_smtp",
    "edge_runtime",
    "analytics",
    "storage.s3_protocol",
    "storage.vector",
    "db.pooler",
    "db.seed",
]
for section in sections:
    text = re.sub(
        rf"(?m)^(\[{re.escape(section)}\]\n(?:#[^\n]*\n)*)enabled = true",
        r"\1enabled = false",
        text,
        count=1,
    )
text = re.sub(
    r"(?m)^(\[experimental\]\n(?:#[^\n]*\n)*)stack = false",
    r"\1stack = true",
    text,
    count=1,
)
path.write_text(text)
PY
  if [[ ! -f supabase/migrations/20260101000000_init.sql ]]; then
    mkdir -p supabase/migrations
    {
      echo "-- Local development migration generated from supabase/schema.sql and supabase/add-avatar.sql"
      cat supabase/schema.sql
      if [[ -f supabase/add-avatar.sql ]]; then
        printf '\n'
        cat supabase/add-avatar.sql
      fi
    } > supabase/migrations/20260101000000_init.sql
  fi
  supabase stack start --runtime native --eager --yes
  set -a
  # shellcheck disable=SC2046
  eval "$(supabase stack status --env --output-format text | sed 's/^/export /')"
  set +a
  NEXT_PUBLIC_SUPABASE_URL="$API_URL"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
fi

umask 077
{
  echo "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
  echo "GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.8-flash}"
  if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    echo "GEMINI_API_KEY=${GEMINI_API_KEY}"
  fi
} > .env.local

ready=0
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health"; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "Supabase auth did not become ready at ${NEXT_PUBLIC_SUPABASE_URL}" >&2
  exit 1
fi

exec npm run dev -- --port 3000
