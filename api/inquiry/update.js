export default function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'PATCH only' } });
  }
  const { id, status } = req.body ?? {};
  if (!id || !status) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing id or status' } });
  }
  const valid = ['new', 'contacted', 'dealed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${valid.join(', ')}` } });
  }
  res.status(200).json({ success: true, data: { id, status, updatedAt: new Date().toISOString() }, message: 'ok' });
}
