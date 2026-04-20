export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  const { id, status } = req.body ?? {};
  if (!id || !status) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing id or status' } });
  res.status(200).json({ success: true, data: { id, status, updatedAt: new Date().toISOString() }, message: 'ok' });
}
