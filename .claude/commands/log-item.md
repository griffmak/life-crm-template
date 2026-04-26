# Log Item

Parse the following natural language input and log it to the Life CRM.

Input: $ARGUMENTS

## Steps

1. Read memory/LIFE-CRM.md and memory/CATEGORIES.md.

2. Parse the input:
   - What is the item name?
   - Which category matches best from CATEGORIES.md?
   - Is there a due date, person's name, or amount mentioned?
   - Is this recurring or one-time?

3. Format the Firestore fields object using typed values. Use nullValue for
   missing optional fields (do not omit them — keeps schema consistent):
   ```
   {
     "name": {"stringValue": "[item name]"},
     "category": {"stringValue": "[matched category]"},
     "status": {"stringValue": "active"},
     "urgency": {"stringValue": "[high|medium|low per CLAUDE.md rules]"},
     "source": {"stringValue": "imessage"},
     "confidence": {"stringValue": "confirmed"},
     "notes": {"stringValue": "[original input text]"},
     "created_at": {"stringValue": "[ISO timestamp]"},
     "updated_at": {"stringValue": "[ISO timestamp]"},
     "next_due": {"stringValue": "[YYYY-MM-DD or null]"},
     "last_done": {"nullValue": null},
     "amount": {"doubleValue": [number or 0]},
     "recurrence": {"stringValue": "[monthly|annual|quarterly|one-time|irregular]"},
     "people": {"arrayValue": {"values": [{"stringValue": "[name]"}]}}
   }
   ```
   If no people mentioned, use: `"people": {"arrayValue": {"values": []}}`

4. Write to Firestore:
   ```
   bash scripts/firestore.sh create items '[FIELDS_JSON]'
   ```

5. Append to memory/INTAKE-LOG.md:
   `[DATE] "[original input]" → [category]: [item name]`

6. Update memory/LIFE-CRM.md to include the new item under its category section.

7. Commit and push:
   ```
   git add memory/LIFE-CRM.md memory/INTAKE-LOG.md
   git commit -m "feat(intake): logged \"[item name]\" to [category]"
   git push origin main
   ```

8. Reply: "Logged: [item name] → [category] (due: [date or 'no date'])"
