#!/usr/bin/env bash
set -euo pipefail

RESEND_API_KEY="${RESEND_API_KEY:?RESEND_API_KEY not set}"
TO="${1:?Recipient email required}"
SUBJECT="${2:?Subject required}"
HTML="${3:?HTML body required}"

TMP_HTML=$(mktemp /tmp/life-crm-html-XXXXXX.html)
TMP_JSON=$(mktemp /tmp/life-crm-email-XXXXXX.json)

# Write HTML to file first — avoids all shell/Python string escaping issues
printf '%s' "$HTML" > "$TMP_HTML"

# Python reads HTML from file and builds proper JSON
python3 - "$TO" "$SUBJECT" "$TMP_HTML" "$TMP_JSON" <<'PYEOF'
import json, sys

to, subject, html_path, json_path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(html_path) as f:
    html = f.read()
with open(json_path, 'w') as f:
    json.dump({"from": "Life CRM <onboarding@resend.dev>", "to": [to], "subject": subject, "html": html}, f)
PYEOF

# curl POSTs the JSON file — no shell string interpolation in the body
curl -sf -X POST \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  --data "@${TMP_JSON}" \
  "https://api.resend.com/emails"

rm -f "$TMP_HTML" "$TMP_JSON"
