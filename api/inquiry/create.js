export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }
  const { products, userName, contact, method, pickupInfo, shippingAddress, estimatedTotal } = req.body ?? {};
  if (!products?.length || !userName || !contact || !method) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
  }
  if (method === 'pickup' && !pickupInfo?.address) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'pickupInfo.address required for pickup' } });
  }
  const inquiry = {
    id: crypto.randomUUID(),
    products,
    userName,
    contact,
    method,
    pickupInfo: method === 'pickup' ? pickupInfo : undefined,
    shippingAddress: method === 'shipping' ? shippingAddress : undefined,
    estimatedTotal: estimatedTotal ?? 0,
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  // Vercel serverless has no persistent state; client persists via Zustand/localStorage.
  res.status(200).json({ success: true, data: inquiry, message: 'ok' });
}
