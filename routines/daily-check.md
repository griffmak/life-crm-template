# Daily Life CRM Check

You are running the daily Life CRM check (Mon–Sat, 8am). Your job is lightweight:
read current item state from Firestore, check for overdue or urgent items, and
send an alert only if action is needed.

## Environment Check

Verify: FIRESTORE_PROJECT_ID, FIRESTORE_API_KEY, RESEND_API_KEY, USER_EMAIL
If missing, append `[DATE] daily-check FAILED — missing env var: [VAR]` to
memory/SCAN-LOG.md, commit, push, stop.

## Execution Steps

### Step 1 — Read current items from Firestore
```
bash scripts/firestore.sh list items
```
Parse the JSON response. Extract all documents where `status.stringValue = "active"`.
Do NOT read LIFE-CRM.md — Firestore is the source of truth and reflects dashboard
mark-done actions that happen between weekly scans.

### Step 2 — Filter urgent items
From the active items, find those where:
- `next_due.stringValue` is today's date or earlier (overdue), OR
- `next_due.stringValue` is within 3 calendar days from today

Items with no next_due are skipped in the daily check (they appear in the weekly
briefing under "Decisions Needed" instead).

### Step 3 — Send alert email (only if urgent items exist)
If zero urgent items: skip email entirely. Go to Step 4.

If urgent items found, compose HTML (use single quotes for attribute values):
- Subject: `Life CRM — Action needed (N items)`
- Body: table with columns — Item | Category | Due Date | Urgency

```
bash scripts/send-email.sh "$USER_EMAIL" "Life CRM — Action needed (N items)" "[HTML]"
```

### Step 4 — Append to SCAN-LOG.md
Append one line: `[DATE] daily-check — X overdue, Y due within 3 days, email: yes/no`
Note: do NOT run `git pull` — cloud routines clone fresh on every run; the repo
is already at HEAD when execution begins.

### Step 5 — Commit and push
```
git add memory/SCAN-LOG.md
git commit -m "feat(check): daily check — X urgent, email sent/skipped"
git push origin main
```
