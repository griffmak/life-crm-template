# CRM Status

Give a quick summary of the current Life CRM state.

## Steps

1. Read memory/LIFE-CRM.md.

2. Count and list:
   - Overdue items (next_due is before today's date, status = active)
   - Due this week (next_due within 7 days, status = active)
   - HIGH urgency items with no next_due (status = active)
   - Total active items

3. Read last line of memory/SCAN-LOG.md for last scan date.

4. Reply:
   ```
   Life CRM status:
   🔴 Overdue: [N] — [comma-separated item names]
   🟡 Due this week: [N] — [comma-separated item names]
   ⚪ Total active: [N]
   Last scan: [date from SCAN-LOG.md]
   ```
