export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();

  const { FIRESTORE_PROJECT_ID, FIRESTORE_API_KEY } = process.env;
  const base = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

  const { id, recurrence } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });

  const now = new Date();
  const isoNow = now.toISOString();

  const calculateNextDue = (recurrence, from) => {
    const d = new Date(from);
    switch (recurrence) {
      case 'monthly':   d.setMonth(d.getMonth() + 1); break;
      case 'annual':    d.setFullYear(d.getFullYear() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      default: return null;
    }
    return d.toISOString().split('T')[0];
  };

  const nextDue = calculateNextDue(recurrence, now);
  const isRecurring = nextDue !== null;

  const fields = {
    status: { stringValue: isRecurring ? 'active' : 'done' },
    last_done: { stringValue: isoNow },
    updated_at: { stringValue: isoNow },
  };
  if (isRecurring) {
    fields.next_due = { stringValue: nextDue };
  }

  const fieldPaths = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join('&');
  const result = await fetch(`${base}/items/${id}?key=${FIRESTORE_API_KEY}&${fieldPaths}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });

  const data = await result.json();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ ...data, nextDue });
}
