export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { FIRESTORE_PROJECT_ID, FIRESTORE_API_KEY } = process.env;
  const base = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

  const [itemsRes, runsRes] = await Promise.all([
    fetch(`${base}/items?key=${FIRESTORE_API_KEY}&pageSize=200`),
    fetch(`${base}/runs?key=${FIRESTORE_API_KEY}&pageSize=10`)
  ]);

  const [itemsData, runsData] = await Promise.all([
    itemsRes.json(),
    runsRes.json()
  ]);

  const parseField = (field) => {
    if (!field) return null;
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.doubleValue !== undefined) return field.doubleValue;
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.nullValue !== undefined) return null;
    if (field.arrayValue) return field.arrayValue.values?.map(v => parseField(v)) ?? [];
    return null;
  };

  const items = (itemsData.documents || []).map(doc => {
    const id = doc.name.split('/').pop();
    const f = doc.fields || {};
    return {
      id,
      name: parseField(f.name),
      category: parseField(f.category),
      status: parseField(f.status),
      urgency: parseField(f.urgency),
      recurrence: parseField(f.recurrence),
      amount: parseField(f.amount),
      last_done: parseField(f.last_done),
      next_due: parseField(f.next_due),
      source: parseField(f.source),
      confidence: parseField(f.confidence),
      notes: parseField(f.notes),
      people: parseField(f.people),
      created_at: parseField(f.created_at),
      updated_at: parseField(f.updated_at),
    };
  });

  // Sort runs client-side descending by run_at — avoids Firestore index requirement
  const sortedRuns = (runsData.documents || []).sort((a, b) => {
    const aDate = a.fields?.run_at?.stringValue ?? '';
    const bDate = b.fields?.run_at?.stringValue ?? '';
    return bDate.localeCompare(aDate);
  });

  const lastRunFields = sortedRuns[0]?.fields ?? null;
  const lastRun = lastRunFields ? {
    run_at: parseField(lastRunFields.run_at),
    type: parseField(lastRunFields.type),
    items_new: parseField(lastRunFields.items_new),
    items_updated: parseField(lastRunFields.items_updated),
    summary: parseField(lastRunFields.summary),
  } : null;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ items, lastRun });
}
