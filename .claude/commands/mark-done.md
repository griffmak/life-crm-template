# Mark Item Done

Mark a Life CRM item as complete.

Input: $ARGUMENTS

## Steps

1. Read memory/LIFE-CRM.md.

2. Find the best match for the item name in $ARGUMENTS. If ambiguous (2+ items
   with similar names), list the top 3 candidates and ask for clarification.
   Do not proceed until the item is unambiguously identified.

3. Get the Firestore document ID for the matched item:
   ```
   bash scripts/firestore.sh list items
   ```
   Parse the response. Find the document where `fields.name.stringValue` matches.
   Extract the document ID from the `name` field of the document (last path segment).

4. Determine next_due for recurring items:
   - recurrence = "monthly": add 1 month to today's date
   - recurrence = "annual": add 1 year to today's date
   - recurrence = "quarterly": add 3 months to today's date
   - recurrence = "one-time" or "irregular" or null: next_due = null, status = "done"

5. Update the document:
   If recurring (next_due calculated):
   ```
   bash scripts/firestore.sh write items [DOC_ID] \
     '{"status":{"stringValue":"active"},"last_done":{"stringValue":"[ISO_DATE]"},"next_due":{"stringValue":"[NEXT_DUE_DATE]"},"updated_at":{"stringValue":"[ISO_DATE]"}}'
   ```
   If one-time (no next_due):
   ```
   bash scripts/firestore.sh write items [DOC_ID] \
     '{"status":{"stringValue":"done"},"last_done":{"stringValue":"[ISO_DATE]"},"updated_at":{"stringValue":"[ISO_DATE]"}}'
   ```

6. Update memory/LIFE-CRM.md — remove item from active list or update next_due.

7. Commit and push:
   ```
   git add memory/LIFE-CRM.md
   git commit -m "feat(intake): marked \"[item name]\" done"
   git push origin main
   ```

8. Reply: "Done ✓ [item name]" and if recurring: "(next due: [date])"
