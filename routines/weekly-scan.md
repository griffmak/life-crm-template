# Weekly Life CRM Scan

You are running the weekly Life CRM scan. Today is a Sunday. Your job is to
read the user's Gmail, extract adult responsibilities, update Firestore, update
the Git memory files, and send a weekly briefing email.

## Environment Check

Before doing anything, verify these env vars are set. If any are missing, log
the failure to memory/SCAN-LOG.md with the format `[DATE] weekly-scan FAILED —
missing env var: [VAR_NAME]`, commit, push, and stop.

Required: FIRESTORE_PROJECT_ID, FIRESTORE_API_KEY, RESEND_API_KEY,
ANTHROPIC_API_KEY, USER_EMAIL

## Execution Steps

### Step 1 — Read current state
Read memory/LIFE-CRM.md and memory/CATEGORIES.md.

### Step 2 — Determine Gmail lookback window
Read memory/SCAN-LOG.md. If it contains any line starting with
`weekly-scan`, a prior weekly scan has run — use `newer_than:7d`.
Otherwise this is the first weekly scan — use `newer_than:90d` for all
Gmail queries below (90-day historical lookback to build the full picture).

### Step 3 — Search Gmail
Use Gmail MCP to run each query below (substituting the lookback window from
Step 2). For each email found, extract: item name, category (match to
CATEGORIES.md), amount (if present), due date (if present), recurrence pattern
(if detectable from multiple emails for the same sender/item), sender.

Queries:
- `subject:(bill OR invoice OR receipt OR payment) newer_than:Xd`
- `subject:(subscription OR renewal OR your plan) newer_than:Xd`
- `subject:(appointment OR reminder OR confirmation) newer_than:Xd`
- `subject:(renewal OR renew OR expires) newer_than:Xd`
- `subject:(rent OR lease) newer_than:Xd`
- `subject:(tax OR estimated payment OR quarterly) newer_than:Xd`
- `subject:(domain OR hosting) newer_than:Xd`

### Step 4 — Classify and deduplicate
For each email found:
- If item already exists in LIFE-CRM.md: update `next_due`, `amount`,
  `updated_at`. Set confidence to "confirmed" if seen 2+ times.
- If new item: create it. Set confidence to "inferred".
- Calculate urgency per the rules in CLAUDE.md.

### Step 5 — Write to Firestore
For each new item:
```
bash scripts/firestore.sh create items '[FIELDS_JSON]'
```
For each updated item (use the Firestore document ID from the list call):
```
bash scripts/firestore.sh list items
# Find document ID where name.stringValue matches, then:
bash scripts/firestore.sh write items [DOC_ID] '[FIELDS_JSON]'
```
Log this run to the runs collection:
```
bash scripts/firestore.sh create runs \
  '[{"run_at":{"stringValue":"[ISO_DATETIME]"},"type":{"stringValue":"weekly-scan"},"items_new":{"doubleValue":N},"items_updated":{"doubleValue":N},"summary":{"stringValue":"X new, Y updated"}}]'
```

### Step 6 — Update LIFE-CRM.md
Rewrite memory/LIFE-CRM.md with the full current state: last updated timestamp,
total item count, all active items grouped by category (name | next_due | urgency).

### Step 7 — Append to SCAN-LOG.md
Append one line: `[DATE] weekly-scan — X new, Y updated, Z total items`

If this was the first run (SCAN-LOG.md had "_No runs yet_"), replace that line
rather than appending.

### Step 8 — Compose and send weekly briefing email

IMPORTANT: Do NOT write a Python script or use urllib to send this email.
The only correct method is to write the HTML to a file, then call send-email.sh.
send-email.sh uses curl internally — Python-based HTTP clients are blocked by Cloudflare.

Steps:
1. Write the HTML body to `/tmp/briefing.html` using the Write tool (not Bash heredoc)
2. Run: `bash scripts/send-email.sh "$USER_EMAIL" "Life CRM — Weekly Briefing $(date +%Y-%m-%d)" "$(cat /tmp/briefing.html)"`
3. If the script exits non-zero, log the failure to SCAN-LOG.md and continue to Step 9

HTML sections (use single quotes for all attribute values):
1. **This Week** — items with next_due within 7 days, sorted by due date
2. **Coming Up (30 days)** — items with next_due within 30 days
3. **Decisions Needed** — HIGH urgency items with no due date, amount changed, or renewals worth reconsidering
4. **Newly Detected** — items found for the first time this scan (confidence: inferred)

### Step 9 — Commit and push
```
git add memory/LIFE-CRM.md memory/SCAN-LOG.md
git commit -m "feat(scan): weekly scan complete — X new, Y updated"
git push origin main
```
If push fails, retry once. If it fails again, log `[DATE] weekly-scan — push failed`
to SCAN-LOG.md and stop.
