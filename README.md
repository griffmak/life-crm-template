# Life CRM

An autonomous personal life management agent built on Claude Code cloud routines.

Reads your Gmail weekly, tracks adult responsibilities across 8 categories, surfaces what needs attention, and sends you a briefing email. Text yourself via iMessage to log things in real time — the system picks it up automatically within 5 minutes.

## How It Works

| When | What |
|------|------|
| Sunday 8am | Claude reads your Gmail (90-day lookback on first run, 7 days after), extracts bills, subscriptions, appointments, renewals, writes to Firestore, commits a memory snapshot to Git, emails you a weekly briefing |
| Mon–Sat 8am | Lightweight check: reads Firestore, emails you only if something is overdue or due within 3 days |
| Anytime | Text yourself to log things — "dentist May 20", "renew passport", "cancel WeTransfer $25/mo". Picked up automatically within 5 minutes via a local listener on your Mac |
| Anytime | Open the dashboard, click a category, click Mark Done. Recurring items auto-advance. |

## Architecture

```
Gmail MCP → Claude (weekly scan) → Firestore ← Claude (daily check)
iMessage (self-texts) → local Python poller → Firestore
Firestore → Vercel dashboard (/api/data)
Dashboard Mark Done → /api/complete → Firestore
```

- **Firestore** — source of truth for all items
- **LIFE-CRM.md** — agent's Git memory snapshot, written after every weekly scan
- **Vercel** — static dashboard + 2 serverless API routes, reads Firestore directly
- **launchd** — runs the iMessage poller every 5 minutes on your Mac

## Setup

### Prerequisites

- Claude Code subscription (Routines access required)
- Firebase account — [console.firebase.google.com](https://console.firebase.google.com) (free Spark plan)
- Resend account — [resend.com](https://resend.com) (free tier, 3,000 emails/month)
- Vercel account — [vercel.com](https://vercel.com) (Hobby plan, free)
- GitHub account

### Step 1 — Fork and clone

Fork this repo. Clone your fork **outside iCloud Drive** — iCloud paths cause ETIMEDOUT errors when Node/bash scripts try to read files. Use `~/life-crm` or similar.

```bash
git clone https://github.com/YOUR_USERNAME/life-crm ~/life-crm
```

### Step 2 — Firebase / Firestore

1. Create a Firebase project
2. Enable Firestore Database → start in **test mode** (open rules — fine for a personal tool)
3. Project Settings → General → copy:
   - **Project ID** → `FIRESTORE_PROJECT_ID`
   - **Web API Key** → `FIRESTORE_API_KEY`

### Step 3 — Resend

1. Create account at resend.com
2. Copy your API key → `RESEND_API_KEY`
3. No domain verification needed for personal use — `onboarding@resend.dev` works as sender when emailing your own registered address

### Step 4 — Deploy to Vercel

```bash
cd ~/life-crm
npx vercel --prod --yes
# First deploy will be missing env vars — that's expected

# Add env vars (use printf, not echo — echo adds a trailing newline that corrupts values)
printf 'your-project-id' | vercel env add FIRESTORE_PROJECT_ID production --yes
printf 'your-api-key'    | vercel env add FIRESTORE_API_KEY    production --yes

# Redeploy so env vars take effect
npx vercel --prod --yes

# Verify
curl https://your-app.vercel.app/api/data
# Expected: {"items":[],"lastRun":null}
```

Update `CLAUDE.md` with your dashboard URL.

### Step 5 — GitHub permissions for Claude

1. Install the Claude GitHub App on your fork: [github.com/apps/claude](https://github.com/apps/claude) → Install → select your `life-crm` repo → grant **Contents: Read & Write**
2. In your repo: Settings → Actions → General → Workflow permissions → enable **Read and write permissions** + **Allow GitHub Actions to create and approve pull requests**

Without step 2, the cloud routines can't push commits.

### Step 6 — Cloud routines

In a Claude Code session, use the `schedule` skill to create two triggers.

**Critical: no env vars field exists in the trigger API.** Embed credentials as `export` commands at the top of each routine prompt. Open `routines/weekly-scan.md` and `routines/daily-check.md` — add this block at the top of each:

```
export FIRESTORE_PROJECT_ID=your-project-id
export FIRESTORE_API_KEY=your-api-key
export RESEND_API_KEY=your-resend-key
export USER_EMAIL=your@email.com
```

Do NOT set `ANTHROPIC_API_KEY` — the cloud routine agent is Claude, it doesn't need one.

**Cron schedules (UTC):**
- Weekly scan: `0 13 * * 0` (Sunday 8am EST)
- Daily check: `0 13 * * 1-6` (Mon–Sat 8am EST)

**Add sources so the routine can clone your repo:**
```json
"sources": [{"git_repository": {"url": "https://github.com/YOUR_USERNAME/life-crm"}}]
```

### Step 7 — Connect Gmail MCP

1. Go to [claude.ai/customize/connectors](https://claude.ai/customize/connectors) → connect Gmail
2. Then use the `schedule` skill → update your weekly-scan trigger → attach the Gmail connector

Both steps are required — connecting Gmail globally does not automatically make it available to triggers.

### Step 8 — iMessage auto-listener (Mac only)

This runs a local Python script on your Mac that polls `chat.db` every 5 minutes for self-texts.

**Prerequisites:** Python 3.9+ and `requests` library (`pip3 install requests`)

1. Copy `tools/imessage-intake.py` from the AI-Workspace repo (or write your own based on the pattern)
2. Deploy to `~/.imessage-intake.py` (outside iCloud)
3. Create `~/.imessage-intake-env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   FIRESTORE_PROJECT_ID=your-project-id
   FIRESTORE_API_KEY=your-api-key
   RESEND_API_KEY=your-resend-key
   USER_EMAIL=your@email.com
   USER_PHONE=your-10-digit-phone-number
   ```
4. Create `~/imessage-intake.sh`:
   ```bash
   #!/bin/bash
   set -a
   source /Users/YOUR_USERNAME/.imessage-intake-env
   set +a
   exec /usr/bin/python3 /Users/YOUR_USERNAME/.imessage-intake.py
   ```
5. Create a minimal `.app` bundle at `~/imessage-intake-runner.app/Contents/MacOS/imessage-intake-runner` that calls the launcher — macOS Sequoia requires a `.app` bundle to grant Full Disk Access (raw scripts are blocked)
6. Grant Full Disk Access to the `.app` bundle: Mac Settings → Privacy & Security → Full Disk Access
7. Create and load the launchd plist:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key><string>com.yourname.imessage-intake</string>
       <key>ProgramArguments</key>
       <array><string>/Users/YOUR_USERNAME/imessage-intake-runner.app/Contents/MacOS/imessage-intake-runner</string></array>
       <key>StartInterval</key><integer>300</integer>
       <key>StandardOutPath</key><string>/tmp/imessage-intake.log</string>
       <key>StandardErrorPath</key><string>/tmp/imessage-intake.log</string>
       <key>RunAtLoad</key><false/>
   </dict>
   </plist>
   ```
   Save to `~/Library/LaunchAgents/com.yourname.imessage-intake.plist`, then:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.yourname.imessage-intake.plist
   ```

**Test:** Text yourself something like `dentist appointment May 20`. Wait 5 minutes. Check `/tmp/imessage-intake.log` — you should see it classified and written to Firestore.

### Step 9 — First run

Trigger the weekly scan manually from the `schedule` skill. Wait 3–5 minutes. Verify:
- Firebase console → `items` collection has documents
- Your inbox has a "Life CRM — Weekly Briefing" email
- GitHub shows a new commit on main
- Dashboard shows populated category cards

### Step 10 — Customize categories

Edit `memory/CATEGORIES.md` to match your life. Remove what doesn't apply (no car? delete Vehicles. No roommate? delete Roommate Finance). Add your own. The agent reads this file on every run.

## Categories (default)

Housing · Bills & Subscriptions · Health · Social & Plans · Taxes & Business · NYC & Bureaucratic · Digital · Roommate Finance

## Slash Commands

Run these from a Claude Code session at `~/life-crm`:

| Command | What it does |
|---------|-------------|
| `/log-item dentist May 20` | Manually log an item |
| `/mark-done Monthly Rent` | Mark an item done; recurring items auto-advance |
| `/crm-status` | Quick summary: overdue count, due this week, last scan date |

## Known Gotchas

See the full build guide and gotchas at the [wiki page](https://github.com/griffmak/ai-workspace/wiki) — covers every plan-vs-reality divergence from the original build.

Key ones:
- **No env vars field in CCR triggers** — embed `export VAR=value` in the prompt body
- **Firestore PATCH without `updateMask` replaces the entire document** — always include `updateMask.fieldPaths` on partial updates
- **iMessage FDA requires a `.app` bundle on macOS Sequoia** — raw scripts are blocked
- **Gmail MCP must be attached per-trigger** — connecting globally isn't enough
- **Clone repo outside iCloud Drive** — iCloud paths cause ETIMEDOUT on bash/Node file reads
- **Seeded items need `status: "active"`** — dashboard filters on this field; items without it are invisible
