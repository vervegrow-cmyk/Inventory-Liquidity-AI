export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  // Vercel serverless has no persistent state; client manages orders via localStorage.
  res.status(200).json({ success: true, data: [], message: 'ok' });
}
