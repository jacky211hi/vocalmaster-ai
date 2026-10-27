#!/usr/bin/env bash
# Idempotent Cloud Agent install for VocalMaster AI.
# Installs the Supabase CLI, Node dependencies, and native local-stack artifacts.
# Does not start Postgres, Auth, or the Next.js dev server.
set -euo pipefail
cd /workspace

export SUPABASE_TELEMETRY_DISABLED=1
export SUPABASE_EXPERIMENTAL_STACK=1
export DO_NOT_TRACK=1

SUPABASE_CLI_VERSION="2.122.0"

if ! command -v supabase >/dev/null 2>&1 || [[ "$(supabase --version 2>/dev/null | tr -d '[:space:]')" != "$SUPABASE_CLI_VERSION" ]]; then
  tmp="$(mktemp)"
  curl -fsSL -o "$tmp" "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.tar.gz"
  sudo tar -xzf "$tmp" -C /usr/local/bin supabase
  sudo chmod 755 /usr/local/bin/supabase
  rm -f "$tmp"
fi

npm ci

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
  if [[ ! -f supabase/schema.sql ]]; then
    echo "supabase/schema.sql is missing; cannot create the local migration" >&2
    exit 1
  fi
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

supabase stack install --runtime native
