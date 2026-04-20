export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  const { item, method, address, scheduledTime } = req.body ?? {};
  if (!item || !method) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing item or method' } });
  const order = {
    id: crypto.randomUUID(),
    ...item,
    method,
    address,
    scheduledTime,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  res.status(200).json({ success: true, data: order, message: 'ok' });
}
